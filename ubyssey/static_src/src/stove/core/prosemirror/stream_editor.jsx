import { EditorState } from "prosemirror-state";
import { Fragment } from "prosemirror-model";
import * as Y from "yjs";
import {
  defaultDeleteFilter,
  defaultProtectedNodes,
  prosemirrorToYXmlFragment,
  ySyncPluginKey,
  yXmlFragmentToProseMirrorRootNode,
} from "y-prosemirror";

import { samePath } from "./fields.js";
import { clone, createStreamBlockNodeFromRegistry } from "./serialization.js";
import { streamRichTextSchema, streamSchema } from "./stream_schema.js";

// Contains info like if it was a content (block value changed) or structural (insert/move/delete block) doc change, it is a local change, undo manager info
class StreamModelUpdate {
  constructor(change) {
    this.change = change;
  }
}

// Stream editor per Wagtail StreamField/YJS fragment
export function createStreamEditorFactory({ createEmptyBlock: createDefaultBlock }) {
  function createStreamEditor(fieldName, streamEditor, options = {}) {
    const {
      fragment,
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

    const undoManager = new Y.UndoManager(fragment, {
      trackedOrigins: new Set([ySyncPluginKey, StreamModelUpdate]),
      deleteFilter: (item) => defaultDeleteFilter(item, defaultProtectedNodes),
      captureTransaction: (transaction) => transaction.meta.get("addToHistory") !== false,
    });

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
        const currentDoc = yXmlFragmentToProseMirrorRootNode(type, streamRichTextSchema);
        const nodes = (content.toJSON() || []).map((node) => streamRichTextSchema.nodeFromJSON(node));
        type.doc.transact(() => {
          prosemirrorToYXmlFragment(currentDoc.copy(Fragment.fromArray(nodes)), type);
        }, new StreamModelUpdate({ kind: "content" }));
        return true;
      },

      updateDoc(update, change = { kind: "structure" }) {
        const before = this.doc;
        const transaction = update(
          EditorState.create({ doc: before }).tr,
          before,
        );
        if (!transaction?.docChanged) return false;
        fragment.doc.transact(() => {
          prosemirrorToYXmlFragment(transaction.doc, fragment);
        }, new StreamModelUpdate(change));
        return true;
      },

      history: {
        canUndo: () => undoManager.undoStack.length > 0,
        canRedo: () => undoManager.redoStack.length > 0,
        undo: () => {
          if (!undoManager.undoStack.length) return false;
          undoManager.undo();
          return true;
        },
        redo: () => {
          if (!undoManager.redoStack.length) return false;
          undoManager.redo();
          return true;
        },
        stopCapturing: () => { undoManager.stopCapturing(); },
      },
    };

    observedDoc = instance.doc;
    
    // Checks whether itself or nested children not just top level are changed
    fragment.observeDeep((events, transaction) => {
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
      if (kind !== "structure" && fields.every((field) => field && richTextTypes.has(field))) return;

      const changeInfo = {
        before,
        doc: nextDoc,
        instance,
        transaction: null,
        ...change,
        kind,
      };
      onChange(changeInfo);
      changeListeners.forEach((listener) => listener(changeInfo));
    });

    return instance;
  }

  // Walks Schema to find the editable_fields
  function findYStreamBlock(fragment, blockId) {
    return fragment.toArray().find((child) => (
      child.nodeName === "stream_block" && child.getAttribute("id") === blockId
    ));
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
