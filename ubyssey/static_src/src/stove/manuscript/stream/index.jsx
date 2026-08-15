// Creates StreamField Editors

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { EditorState, Plugin } from "prosemirror-state";
import { Fragment } from "prosemirror-model";
import * as Y from "yjs";
import { ProseMirror, ProseMirrorDoc, reactKeys } from "@handlewithcare/react-prosemirror";
// https://docs.yjs.dev/ecosystem/editor-bindings/prosemirror
import {
  defaultDeleteFilter,
  defaultProtectedNodes,
  initProseMirrorDoc,
  prosemirrorToYXmlFragment,
  ySyncPluginKey,
  ySyncPlugin,
  yXmlFragmentToProseMirrorRootNode,
} from "y-prosemirror";

import { editorPlugins } from "../rich_text/index.jsx";
import { createEditorToolbar } from "../rich_text/toolbar.jsx";
import { createStreamBlockNodeFromRegistry } from "./serialization.js";
import { manuscriptRichTextSchema, streamSchema } from "./schema.js";
import { streamNodeViews } from "./node_views.jsx";

// Used in setMeta
const MODEL_CHANGE_META = "modelChange";

// Represents Atomic change, with metadata like skipPreview: true
class StreamModelUpdate {
  constructor(change) {
    this.change = change;
  }
}

export { blockTypeLabel } from "./node_views.jsx";
export { clone, pmDocToStreamValue } from "./serialization.js";
export {
  deleteTopLevelBlock,
  moveTopLevelBlock,
  topLevelBlockInfoByIdOrIndex,
} from "./commands.js";

/*
Hierarchy
Y.Doc
Y.XmlFragment for each StreamField
Y.XmlElement for each stream block
Y.XmlElement for each editable field
Visible Editors

Formerly
Prosemirror Doc
Hidden Stream Editor
Preview Visible Editors

With hacky sync between them (worked for single user)
Should hopefully explain some of the naming, I'll clean this up more later
*/
export function createStreamEditor(textarea, streamEditor, options = {}) {
  const {
    createToolbar = createEditorToolbar,
    fragment,
    onChange = () => {},
    onTransaction = () => {},
  } = options;
  const fieldName = textarea.dataset.streamField;
  const mount = document.querySelector(`[data-stream-editor="${window.CSS.escape(fieldName)}"]`);
  const blockTypes = streamEditor.blockTypes || {};
  const blocks = streamEditor.blocks || [];
  const availableBlockTypes = Array.from(new Set([
    ...Object.keys(blockTypes),
    ...blocks.map((block) => block.type),
  ])).sort((a, b) => a.localeCompare(b));
  let root = null;
  let sidebarToolbar = null;
  let toolbarMount = null;
  const docFromXmlFragment = yXmlFragmentToProseMirrorRootNode(fragment, streamSchema);
  if (docFromXmlFragment) prosemirrorToYXmlFragment(docFromXmlFragment, fragment);
  let observedDoc = null;
  const richTextTypes = new Map();
  const undoManager = new Y.UndoManager(fragment, {
    trackedOrigins: new Set([ySyncPluginKey, StreamModelUpdate]),
    deleteFilter: (item) => defaultDeleteFilter(item, defaultProtectedNodes),
    captureTransaction: (transaction) => transaction.meta.get("addToHistory") !== false,
  });
  const instance = {
    fieldName,
    textarea,
    view: null,
    mount,
    blockTypes,
    availableBlockTypes,
    get doc() {
      if (this.view) return this.view.state.doc;
      return yXmlFragmentToProseMirrorRootNode(fragment, streamSchema);
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
    transact(update, change = {}) {
      fragment.doc.transact(update, new StreamModelUpdate(change));
    },
    writeFieldContent(blockId, path, content) {
      const type = this.fieldType(blockId, path);
      if (!type) return false;
      const currentDoc = yXmlFragmentToProseMirrorRootNode(type, manuscriptRichTextSchema);
      const nodes = (content.toJSON() || []).map((node) => manuscriptRichTextSchema.nodeFromJSON(node));
      type.doc.transact(() => {
        prosemirrorToYXmlFragment(currentDoc.copy(Fragment.fromArray(nodes)), type);
      }, new StreamModelUpdate({ checkStructure: false }));
      return true;
    },
    insertBlock(index, block) {
      const type = new Y.XmlElement(block.type.name);
      prosemirrorToYXmlFragment(block, type);
      fragment.insert(index, [type]);
    },
    deleteBlock(index) {
      fragment.delete(index, 1);
    },
    moveBlock(fromIndex, direction) {
      const targetIndex = fromIndex + direction;
      const blocks = fragment.toArray();
      const firstIndex = Math.min(fromIndex, targetIndex);
      const swapped = direction < 0
        ? [blocks[fromIndex].clone(), blocks[targetIndex].clone()]
        : [blocks[targetIndex].clone(), blocks[fromIndex].clone()];

      this.transact(() => {
        fragment.delete(firstIndex, 2);
        fragment.insert(firstIndex, swapped);
      }, { checkStructure: false, skipPreview: true });
    },
    updateDoc(update, change = {}) {
      const before = this.doc;
      const transaction = update(
        this.view ? this.view.state.tr : EditorState.create({ doc: before }).tr,
        before,
      );
      if (!transaction?.docChanged) return false;
      transaction.setMeta(MODEL_CHANGE_META, change);

      if (this.view) {
        this.view.dispatch(transaction);
      } else {
        fragment.doc.transact(() => {
          prosemirrorToYXmlFragment(transaction.doc, fragment);
        }, new StreamModelUpdate(change));
      }
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
    mountEditor() {
      if (this.view) {
        this.view.updateRoot();
        return this.view;
      }

      const yjsDoc = initProseMirrorDoc(fragment, streamSchema);
      const collaborationPlugins = [ySyncPlugin(fragment, { mapping: yjsDoc.mapping })];
      const transactionObserver = transactionObserverPlugin(instance, {
        onChange,
        onTransaction,
        updateToolbar: () => { sidebarToolbar?.update(); },
      });
      const defaultState = EditorState.create({
        doc: yjsDoc.doc,
        plugins: [
          ...collaborationPlugins,
          reactKeys(),
          ...editorPlugins(streamSchema, {
            includeHistory: false,
            undoCommand: historyCommand(instance.history, "undo"),
            redoCommand: historyCommand(instance.history, "redo"),
          }),
          transactionObserver,
        ],
      });

      toolbarMount = document.createElement("div");
      toolbarMount.className = "pm-sidebar-toolbar";
      mount.before(toolbarMount);
      root = createRoot(mount);
      flushSync(() => {
        root.render(
          <StreamEditor
            defaultState={defaultState}
            blockTypes={blockTypes}
            availableBlockTypes={availableBlockTypes}
          />,
        );
      });
      sidebarToolbar = createToolbar(toolbarMount, { view: instance.view });
      return this.view;
    },
    unmountEditor() {
      if (!root) return;
      sidebarToolbar?.destroy();
      sidebarToolbar = null;
      root.unmount();
      root = null;
      toolbarMount.remove();
      toolbarMount = null;
      this.view = null;
      observedDoc = this.doc;
    },
  };

  observedDoc = instance.doc;
  // Checks whether itself or nested children not just top level are changed
  fragment.observeDeep((events, transaction) => {
    if (instance.view) return;
    const fields = events.map((event) => {
      let current = event.target;
      while (current && current.nodeName !== "editable_field") current = current.parent;
      return current;
    });
    if (fields.every((field) => field && richTextTypes.has(field))) return;

    const change = transaction.origin instanceof StreamModelUpdate ? transaction.origin.change : {};
    if (change.checkStructure === false || fields.every(Boolean)) {
      onChange({ instance, transaction: null, checkStructure: false, ...change });
      return;
    }

    const nextDoc = yXmlFragmentToProseMirrorRootNode(fragment, streamSchema);
    const before = observedDoc;
    observedDoc = nextDoc;
    onChange({
      before,
      doc: nextDoc,
      instance,
      transaction: null,
      sendRemotePreview: !(transaction.origin instanceof StreamModelUpdate),
      ...change,
    });
  });

  return instance;
}

function samePath(left = [], right = []) {
  return JSON.stringify(left || []) === JSON.stringify(right || []);
}

// Walks Schema to find the editable_fields
function findYEditableField(fragment, blockId, targetPath) {
  const block = fragment.toArray().find((child) => (
    child.nodeName === "stream_block" && child.getAttribute("id") === blockId
  ));
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

function StreamEditor({ defaultState, blockTypes, availableBlockTypes }) {
  return (
    <ProseMirror
      defaultState={defaultState}
      nodeViewComponents={streamNodeViews({ blockTypes, availableBlockTypes })}
    >
      <ProseMirrorDoc />
    </ProseMirror>
  );
}

function historyCommand(history, action) {
  return (_state, dispatch) => {
    if (!dispatch) return action === "undo" ? history.canUndo() : history.canRedo();
    return history[action]();
  };
}

// Identifies transactions that modify top level structure like adding/moving/deleting blocks
function changesTopLevelStructure(transaction) {
  return transaction.mapping.maps.some((stepMap, index) => {
    const before = transaction.docs[index];
    const after = transaction.docs[index + 1] || transaction.doc;
    let changed = false;

    stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
      const oldFrom = before.resolve(oldStart);
      const oldTo = before.resolve(oldEnd);
      const newFrom = after.resolve(newStart);
      const newTo = after.resolve(newEnd);
      changed = (
        oldFrom.depth === 0
        || oldTo.depth === 0
        || oldFrom.index(0) !== oldTo.index(0)
        || newFrom.depth === 0
        || newTo.depth === 0
        || newFrom.index(0) !== newTo.index(0)
      );
    });

    return changed;
  });
}

// Records and handles transactions
function transactionObserverPlugin(instance, { onTransaction, onChange, updateToolbar }) {
  const pendingTransactions = [];
  let executeScheduled = false;

  const executeTransactions = () => {
    for (const transaction of pendingTransactions.splice(0)) {
      updateToolbar();
      onTransaction({ transaction, instance, view: instance.view });
      if (transaction.docChanged) {
        const topLevelStructureChanged = changesTopLevelStructure(transaction);
        const yjsStructureChange = topLevelStructureChanged && Boolean(transaction.getMeta(ySyncPluginKey)?.isChangeOrigin);
        onChange({
          before: transaction.before,
          doc: transaction.doc,
          instance,
          transaction,
          checkStructure: topLevelStructureChanged,
          sendRemotePreview: yjsStructureChange,
          ...(transaction.getMeta(MODEL_CHANGE_META) || {}),
        });
      }
    }

    if (pendingTransactions.length) {
      queueMicrotask(executeTransactions);
    } else {
      executeScheduled = false;
    }
  };

  return new Plugin({
    state: {
      init: () => null,
      apply(transaction, value) {
        pendingTransactions.push(transaction);
        return value;
      },
    },
    view(initialView) {
      instance.view = initialView;
      initialView.streamSource = { instance };
      const stopHistoryCapture = () => { instance.history.stopCapturing(); };
      initialView.dom.addEventListener("focus", stopHistoryCapture, true);

      return {
        update(view) {
          instance.view = view;
          if (!executeScheduled) {
            executeScheduled = true;
            queueMicrotask(executeTransactions);
          }
        },
        destroy() {
          initialView.dom.removeEventListener("focus", stopHistoryCapture, true);
        },
      };
    },
  });
}

// Creates draft block that stays in local doc until completed, to avoid weird validation errors
export function createStreamBlockDraft(instance, blockType) {
  const ydoc = new Y.Doc();
  const fragment = ydoc.getXmlFragment(instance.fieldName);
  const block = createStreamBlockNodeFromRegistry(instance.blockTypes, blockType);
  prosemirrorToYXmlFragment(streamSchema.topNodeType.create(null, block), fragment);

  const draftInstance = createStreamEditor(
    instance.textarea,
    { blockTypes: instance.blockTypes, blocks: [] },
    { fragment },
  );

  return {
    instance: draftInstance,
    destroy() {
      draftInstance.unmountEditor();
      ydoc.destroy();
    },
  };
}
