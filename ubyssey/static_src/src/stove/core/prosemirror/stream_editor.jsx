import { EditorState, TextSelection } from "prosemirror-state";
import { Fragment } from "prosemirror-model";
import * as Y from "yjs";
import {
  defaultDeleteFilter,
  defaultProtectedNodes,
  initProseMirrorDoc,
  prosemirrorToYXmlFragment,
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
  yXmlFragmentToProseMirrorRootNode,
} from "y-prosemirror";
import { v4 as uuidv4 } from "uuid";

import { samePath } from "./fields.js";
import { clone, createStreamBlockNodeFromRegistry } from "./serialization.js";
import { streamRichTextSchema, streamSchema } from "./stream_schema.js";
import { StreamModelUpdate } from "../collaboration/history.js";

// Stream editor per Wagtail StreamField/YJS fragment
export function createStreamEditorFactory({ createEmptyBlock: createDefaultBlock }) {
  function createStreamEditor(fieldName, streamEditor, options = {}) {
    const {
      fragment,
      history,
      onChange = () => {},
      onTransaction = () => {},
    } = options;

    const blockTypes = streamEditor.blockTypes || {};
    const blocks = streamEditor.blocks || [];

    const availableBlockTypes = Array.from(new Set([
      ...Object.keys(blockTypes),
    ])).sort((a, b) => a.localeCompare(b));

    let observedDoc = null;
    const changeListeners = new Set();
    const richTextTypes = new Map();

    const undoManager = history || new Y.UndoManager(fragment, {
      trackedOrigins: new Set([ySyncPluginKey, StreamModelUpdate]),
      deleteFilter: (item) => defaultDeleteFilter(item, defaultProtectedNodes),
      captureTransaction: (transaction) => transaction.meta.get("addToHistory") !== false,
    });

    // Occasionally block IDs somehow get duplicated which this should fix
    let repairingIdentity = false;
    normalizeStreamBlockIds(fragment);

    const instance = {
      fieldName,
      blockTypes,
      availableBlockTypes,

      get doc() {
        return yXmlFragmentToProseMirrorRootNode(fragment, streamSchema);
      },

      createEmptyBlock() {
        return createDefaultBlock(fieldName, streamEditor);
      },

      snapshot() {
        return clone(this.doc.toJSON());
      },

      fieldType(blockId, path = []) {
        return findYEditableField(fragment, blockId, path);
      },

      registerRichTextType(type) {
        richTextTypes.set(type, (richTextTypes.get(type) || 0) + 1);
        return () => {
          const remaining = richTextTypes.get(type) - 1;
          if (remaining) richTextTypes.set(type, remaining);
          else richTextTypes.delete(type);
        };
      },

      subscribe(listener) {
        changeListeners.add(listener);
        return () => changeListeners.delete(listener);
      },

      notifyTransaction(payload) {
        onTransaction(payload);
      },

      transact(update, change = {}) {
        fragment.doc.transact(update, new StreamModelUpdate(change));
      },

      writeFieldContent(blockId, path, content) {
        const type = this.fieldType(blockId, path);
        if (!type) return false;
        type.doc.transact(() => writeYFieldContent(type, content), new StreamModelUpdate({ kind: "content" }));
        return true;
      },

      splitRichTextBlock({ blockId, path = [], splitPosition, selectionFrom = null, selectionTo = null, block }) {
        const streamBlock = findYStreamBlock(fragment, blockId);
        const field = findYEditableField(fragment, blockId, path);
        if (!streamBlock || !field || streamBlock.getAttribute("blockType") !== "richtext") return null;

        const live = yXmlFragmentToProseMirrorRootNode(field, streamRichTextSchema);
        const mapping = initProseMirrorDoc(field, streamRichTextSchema).mapping;
        const resolve = (position) => position && relativePositionToAbsolutePosition(
          field.doc,
          field,
          position,
          mapping,
        );
        const liveFrom = resolve(selectionFrom || splitPosition);
        const liveTo = resolve(selectionTo || splitPosition);
        if (liveFrom === null || liveTo === null || liveFrom === undefined || liveTo === undefined) return null;

        let transaction = EditorState.create({ doc: live }).tr.setSelection(selectionFrom && selectionTo ? TextSelection.create(live, liveFrom, liveTo) : TextSelection.create(live, liveFrom));
        if (selectionFrom && selectionTo && liveFrom !== liveTo) {
          transaction = transaction.delete(Math.min(liveFrom, liveTo), Math.max(liveFrom, liveTo));
        }
        const splitAt = transaction.selection.from;
        const before = transaction.doc.slice(0, splitAt).content;
        const after = transaction.doc.slice(splitAt).content;
        const splittingAtStart = splitAt === 1;
        const newBlock = block.copy(Fragment.from(block.child(0).copy(splittingAtStart ? before : after)));
        const blockIndex = fragment.toArray().indexOf(streamBlock);
        if (blockIndex < 0) return null;

        fragment.doc.transact(() => {
          writeYFieldContent(field, splittingAtStart ? after : before);
          insertYStreamBlock(fragment, blockIndex + (splittingAtStart ? 0 : 1), newBlock);
        }, new StreamModelUpdate({ kind: "structure" }));

        return {
          blockId: newBlock.attrs.id,
          splittingAtStart,
        };
      },

      mergeRichTextBlock({ blockId, path = [] }) {
        const streamBlock = findYStreamBlock(fragment, blockId);
        if (!streamBlock || streamBlock.getAttribute("blockType") !== "richtext") return null;
        const blockIndex = fragment.toArray().indexOf(streamBlock);
        const previousBlock = blockIndex > 0 ? fragment.get(blockIndex - 1) : null;
        if (!previousBlock || previousBlock.nodeName !== "stream_block" || previousBlock.getAttribute("blockType") !== "richtext") return null;

        const previousId = previousBlock.getAttribute("id");
        const previousField = findYEditableField(fragment, previousId, path);
        const currentField = findYEditableField(fragment, blockId, path);
        if (!previousField || !currentField) return null;

        const previousDoc = yXmlFragmentToProseMirrorRootNode(previousField, streamRichTextSchema);
        const currentDoc = yXmlFragmentToProseMirrorRootNode(currentField, streamRichTextSchema);
        const previousNodes = [];
        const currentNodes = [];
        previousDoc.content.forEach((node) => previousNodes.push(node));
        currentDoc.content.forEach((node) => currentNodes.push(node));
        const left = previousNodes[previousNodes.length - 1];
        const right = currentNodes[0];
        if (left?.isTextblock && right?.isTextblock && left.sameMarkup(right)) {
          previousNodes[previousNodes.length - 1] = left.copy(left.content.append(right.content));
          currentNodes.shift();
        }
        const content = Fragment.fromArray([...previousNodes, ...currentNodes]);
        const cursorPosition = previousDoc.content.size - 1;

        fragment.doc.transact(() => {
          writeYFieldContent(previousField, content);
          fragment.delete(blockIndex, 1);
        }, new StreamModelUpdate({ kind: "structure" }));

        return { blockId: previousId, cursorPosition };
      },

      updateDoc(update, change = { kind: "structure" }) {
        const before = this.doc;
        const transaction = update(
          EditorState.create({ doc: before }).tr,
          before,
        );
        if (!transaction?.docChanged) return false;
        const beforeIds = topLevelBlockIds(before);
        const afterIds = topLevelBlockIds(transaction.doc);
        const allowedDeletedIds = new Set(change.deletedBlockIds || []);
        const unexpectedDeletedIds = beforeIds.filter((id) => !afterIds.includes(id) && !allowedDeletedIds.has(id));
        if (unexpectedDeletedIds.length) {
          console.error("Blocked stream update that would delete blocks unexpectedly", {
            fieldName,
            deletedBlockIds: unexpectedDeletedIds,
            change,
          });
          return false;
        }
        fragment.doc.transact(() => {
          prosemirrorToYXmlFragment(transaction.doc, fragment);
        }, new StreamModelUpdate(change));
        return true;
      },

      history: {
        canUndo: () => undoManager.canUndo(),
        canRedo: () => undoManager.canRedo(),
        undo: () => {
          if (!undoManager.canUndo()) return false;
          undoManager.undo();
          return true;
        },
        redo: () => {
          if (!undoManager.canRedo()) return false;
          undoManager.redo();
          return true;
        },
        stopCapturing: () => undoManager.stopCapturing(),
      },
    };

    observedDoc = instance.doc;
    
    // Checks whether itself or nested children not just top level are changed
    fragment.observeDeep((events, transaction) => {
      if (repairingIdentity) return;
      repairingIdentity = true;
      try {
        normalizeStreamBlockIds(fragment);
      } finally {
        repairingIdentity = false;
      }
      const fields = events.map((event) => {
        let current = event.target;
        while (current && current.nodeName !== "editable_field") current = current.parent;
        return current;
      });
      const change = transaction.origin instanceof StreamModelUpdate ? transaction.origin.change : {};
      const nextDoc = yXmlFragmentToProseMirrorRootNode(fragment, streamSchema);
      const before = observedDoc;
      observedDoc = nextDoc;
      const localChange = transaction.origin instanceof StreamModelUpdate;
      const kind = localChange ? change.kind || "structure" : "remote";
      const richTextOnly = fields.length > 0 && fields.every((field) => field && richTextTypes.has(field));
      if (kind !== "structure" && kind !== "remote" && richTextOnly) return;

      const changeInfo = {
        before,
        doc: nextDoc,
        instance,
        transaction: null,
        ...change,
        kind,
        richTextOnly,
      };
      onChange(changeInfo);
      changeListeners.forEach((listener) => listener(changeInfo));
    });

    return instance;
  }

  function topLevelBlockIds(doc) {
    const ids = [];
    doc.forEach((block) => {
      if (block.attrs?.id) ids.push(block.attrs.id);
    });
    return ids;
  }

  // Walks Schema to find the editable_fields
  function findYStreamBlock(fragment, blockId) {
    return fragment.toArray().find((child) => (
      child.nodeName === "stream_block" && child.getAttribute("id") === blockId
    ));
  }

  function normalizeStreamBlockIds(fragment) {
    const seen = new Set();
    const duplicates = fragment.toArray()
      .filter((child) => child.nodeName === "stream_block")
      .filter((child) => {
        const id = child.getAttribute("id");
        if (!id || seen.has(id)) return true;
        seen.add(id);
        return false;
      });
    if (!duplicates.length) return false;

    fragment.doc.transact(() => {
      duplicates.forEach((child) => {
        let id;
        do id = uuidv4(); while (seen.has(id));
        seen.add(id);
        child.setAttribute("id", id);
      });
    }, new StreamModelUpdate({ kind: "structure", identityRepair: true }));
    return true;
  }

  function insertYStreamBlock(fragment, index, block) {
    const yBlock = new Y.XmlElement("stream_block");
    fragment.insert(index, [yBlock]);
    prosemirrorToYXmlFragment(block, yBlock);
  }

  function writeYFieldContent(type, content) {
    const currentDoc = yXmlFragmentToProseMirrorRootNode(type, streamRichTextSchema);
    const nodes = (content.toJSON() || []).map((node) => streamRichTextSchema.nodeFromJSON(node));
    prosemirrorToYXmlFragment(currentDoc.copy(Fragment.fromArray(nodes)), type);
  }

  function findYEditableField(fragment, blockId, targetPath) {
    const block = findYStreamBlock(fragment, blockId);
    if (!block) return null;

    const visit = (parent, pathPrefix = []) => {
      for (const child of parent.toArray()) {
        const path = pathPrefix.concat(child.getAttribute?.("path") || []);
        if (child.nodeName === "editable_field" && samePath(path, targetPath)) return child;
        if (child.nodeName === "struct_field") {
          const field = visit(child, path);
          if (field) return field;
        }
        if (child.nodeName === "list_field") {
          const items = child.toArray().filter((item) => item.nodeName === "list_item");
          for (let index = 0; index < items.length; index += 1) {
            const field = visit(items[index], path.concat(index));
            if (field) return field;
          }
        } else if (child.nodeName === "stream_field") {
          const items = child.toArray().filter((item) => item.nodeName === "stream_item");
          for (let index = 0; index < items.length; index += 1) {
            const field = visit(items[index], path.concat(index));
            if (field) return field;
          }
        } else if (child.nodeName === "stream_item") {
          const field = visit(child, path);
          if (field) return field;
        } else if (child.nodeName !== "struct_field" && child.nodeName && child.toArray) {
          const field = visit(child, pathPrefix);
          if (field) return field;
        }
      }
      return null;
    };

    return visit(block);
  }

  // Creates draft block that stays in local doc until completed, to avoid weird validation errors
  function createStreamBlockDraft(instance, blockType) {
    const ydoc = new Y.Doc();
    const fragment = ydoc.getXmlFragment(instance.fieldName);
    const block = createStreamBlockNodeFromRegistry(instance.blockTypes, blockType);
    prosemirrorToYXmlFragment(streamSchema.topNodeType.create(null, block), fragment);

    const draftInstance = createStreamEditor(
      instance.fieldName,
      { blockTypes: instance.blockTypes, blocks: [] },
      { fragment },
    );

    return {
      instance: draftInstance,
      destroy() {
        ydoc.destroy();
      },
    };
  }

  return { createStreamEditor, createStreamBlockDraft };
}
