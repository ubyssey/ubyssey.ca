// Deals with Modal Block actions toolbar

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { EditorState, Plugin } from "prosemirror-state";
import { ProseMirror, ProseMirrorDoc, reactKeys } from "@handlewithcare/react-prosemirror";
import { Modal } from "../chrome/modal.jsx";

import { editorPlugins } from "../richtext/plugins.js";
import { findBlock, insertBlock, setBlockContent } from "../prosemirror/document.js";
import { topLevelBlockInfoByIdOrIndex } from "../prosemirror/blocks.js";

import {
  PAGE_BLOCK_SELECTOR,
  blockInfoForElement,
  deletePageBlock,
  describePageBlock,
  findPageBlock,
  movePageBlock,
  selectPageBlockElement,
  syncSelectedPageBlockEditor,
} from "./selection.js";
import { pageEditorState } from "../state.js";

const SYNCED_STREAM_META = "syncedStream";

export function mountBlockEditor(instance, descriptor, target, { streamSchema, streamNodeViews }) {
  const block = findBlock(instance, descriptor);
  if (!block || !target) return null;

  const blockId = block.node.attrs.id;
  let root = null;
  let view = null;
  let writeInProgress = false;

  const syncBlock = (change) => {
    if (writeInProgress || !view || !change.doc) return;

    const nextBlock = topLevelBlockInfoByIdOrIndex(change.doc, blockId, null);
    if (!nextBlock) return;

    const modalDoc = streamSchema.topNodeType.create(null, [nextBlock.node]);
    if (!view.state.doc.eq(modalDoc)) {
      view.dispatch(view.state.tr
        .replaceWith(0, view.state.doc.content.size, modalDoc.content)
        .setMeta(SYNCED_STREAM_META, true));
    }
  };

  const unsubscribe = instance.subscribe(syncBlock);
  const defaultState = EditorState.create({
    doc: streamSchema.topNodeType.create(null, [block.node]),
    plugins: [
      reactKeys(),
      ...editorPlugins(streamSchema, {
        includeHistory: false,
        undoCommand: historyCommand(instance.history, "undo"),
        redoCommand: historyCommand(instance.history, "redo"),
      }),
      blockTransactionObserver(instance, blockId, {
        setView: (nextView) => { view = nextView; },
        writeBlock: (nextBlock) => {
          writeInProgress = true;
          try {
            setBlockContent(instance, { blockId }, nextBlock);
          } finally {
            writeInProgress = false;
          }
        },
      }),
    ],
  });

  root = createRoot(target);
  root.render(<BlockEditor defaultState={defaultState} streamNodeViews={streamNodeViews} />);

  return {
    get view() {
      return view;
    },
    updateRoot() {
      view?.updateRoot();
    },
    destroy() {
      unsubscribe();
      root?.unmount();
      root = null;
      view = null;
    },
  };
}

function BlockEditor({ defaultState, streamNodeViews }) {
  return (
    <ProseMirror
      defaultState={defaultState}
      nodeViewComponents={streamNodeViews()}
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

function blockTransactionObserver(instance, blockId, { setView, writeBlock }) {
  const pendingTransactions = [];
  let executeScheduled = false;
  let currentView = null;

  const executeTransactions = () => {
    for (const transaction of pendingTransactions.splice(0)) {
      instance.notifyTransaction({ transaction, instance, view: currentView });
      if (transaction.docChanged && !transaction.getMeta(SYNCED_STREAM_META)) {
        writeBlock(transaction.doc.firstChild);
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
      currentView = initialView;
      setView(initialView);
      initialView.streamSource = { instance, blockId };
      const stopHistoryCapture = () => { instance.history.stopCapturing(); };
      initialView.dom.addEventListener("focus", stopHistoryCapture, true);

      return {
        update(nextView) {
          currentView = nextView;
          setView(nextView);
          if (!executeScheduled) {
            executeScheduled = true;
            queueMicrotask(executeTransactions);
          }
        },
        destroy() {
          initialView.dom.removeEventListener("focus", stopHistoryCapture, true);
          currentView = null;
          setView(null);
        },
      };
    },
  });
}

// Block editing UI


// Modal for Add/Delete/Edit
function BlockModals({ refs, ui, actions, blockTypeLabel }) {
  return (
    <>
      <Modal
        modalRef={(element) => { refs.blockEditorModal = element; }}
        open={ui.blockEditorOpen}
        title={`Edit ${blockTypeLabel(ui.blockType)} block`}
        closeLabel="Close block editor"
        onClose={actions.done}
      >
        <div ref={(element) => { refs.blockEditorContent = element; }} className="pm-page-block-dialog__editor" />
      </Modal>

      <Modal
        modalRef={(element) => { refs.insertDialog = element; }}
        open={ui.insertOpen}
        title={`Add block to ${ui.fieldName}`}
        closeLabel="Close add block"
        onClose={actions.cancelInsert}
      >
        <select
          ref={(element) => { refs.insertSelect = element; }}
          className="pm-page-block-dialog__select"
          aria-label="Block type to insert"
          value={ui.insertType}
          onChange={(event) => { actions.setInsertType(event.currentTarget.value); }}
        >
          {ui.blockTypes.map((blockType) => <option key={blockType} value={blockType}>{blockTypeLabel(blockType)}</option>)}
        </select>
        <div ref={(element) => { refs.insertEditorBody = element; }} className="pm-page-block-dialog__editor" />
        <footer className="page-editor-modal__footer page-block-editor-modal__footer">
          <button type="button" className="pm-page-block-dialog__button--primary" onClick={actions.commitInsert}>Add</button>
          <button type="button" onClick={actions.cancelInsert}>Cancel</button>
        </footer>
      </Modal>

      <Modal
        modalRef={(element) => { refs.deleteDialog = element; }}
        open={ui.deleteOpen}
        title={`Are you sure you want to delete this ${blockTypeLabel(ui.blockType)} block?`}
        closeLabel="Close delete block"
        onClose={actions.closeDialogs}
      >
        <footer className="page-editor-modal__footer page-block-editor-modal__footer">
          <button type="button" className="pm-page-block-dialog__button--danger" onClick={actions.confirmDelete}>Delete</button>
          <button type="button" onClick={actions.closeDialogs}>Cancel</button>
        </footer>
      </Modal>
    </>
  );
}

// Handles Block Actions modal logic
export function setupBlockEditorActions(root, { blockTypeLabel, createBlockEditor, createStreamBlockDraft, preview }) {
  if (!root) return null;
  const state = pageEditorState;
  const modalContainer = document.querySelector("[data-page-form]");
  const moveBlock = (instance, pageBlock, direction) => {
    instance.history.stopCapturing();
    const moved = movePageBlock(instance, pageBlock, direction);
    if (moved) preview.refreshDoc({ immediate: true });
    instance.history.stopCapturing();
    return moved;
  };
  state.blockActions?.cleanup();
  state.blockActions = null;

  const modalMount = document.createElement("div");
  modalContainer.appendChild(modalMount);

  const modalRoot = createRoot(modalMount);
  const refs = {
    blockEditorContent: null,
    insertEditorBody: null,
    insertSelect: null,
    insertDialog: null,
    deleteDialog: null,
  };
  const ui = {
    blockTypes: [],
    blockType: "",
    fieldName: "",
    insertType: "",
    blockEditorOpen: false,
    insertOpen: false,
    deleteOpen: false,
  };

  let blockEditorHome = null;
  let pendingAdd = null;
  let mounted = true;

  const render = () => {
    if (!mounted) return;
    flushSync(() => {
      modalRoot.render(<BlockModals refs={refs} ui={ui} actions={UIactions} blockTypeLabel={blockTypeLabel} />);
    });
  };

  const selectClickedBlock = (event) => {
    let blockElement = event.composedPath().map((target) => target.closest?.(PAGE_BLOCK_SELECTOR)).find(Boolean);
    if (!blockElement) return;

    let parentBlock = blockElement.parentElement?.closest(PAGE_BLOCK_SELECTOR);

    while (parentBlock && root.contains(parentBlock)) {
      blockElement = parentBlock;
      parentBlock = blockElement.parentElement?.closest(PAGE_BLOCK_SELECTOR);
    }
    selectPageBlockElement(blockElement);
  };
  root.addEventListener("click", selectClickedBlock, true);

  const syncModalState = () => {
    state.blockEditorModalOpen = ui.blockEditorOpen || ui.insertOpen || ui.deleteOpen;
    state.blockEditorEditing = ui.blockEditorOpen;
  };

  const selectedBlock = () => {
    const descriptor = state.selectedBlock;
    if (!descriptor) return null;
    const blockElement = findPageBlock(root, descriptor);
    const instance = blockElement && state.streamEditors
      .find((item) => item.fieldName === descriptor.fieldName);
    const info = instance && blockInfoForElement(instance, blockElement);
    return instance && info ? { descriptor, blockElement, instance, info } : null;
  };

  const fillInsertTypes = (instance) => {
    const blockTypes = instance.availableBlockTypes;
    const preferredValue = state.preferredInsertTypes.get(instance.fieldName);
    const nextValue = [preferredValue, ui.insertType, blockTypes[0]]
      .find((value) => value && blockTypes.includes(value));
    ui.blockTypes = blockTypes;
    ui.insertType = nextValue;
    state.preferredInsertTypes.set(instance.fieldName, nextValue);
  };

  const syncActiveBlock = () => {
    const active = selectedBlock();
    if (!active) return null;
    ui.blockType = active.info.node.attrs.blockType;
    ui.fieldName = active.instance.fieldName;
    fillInsertTypes(active.instance);
    return active;
  };

  const restoreBlockEditorHome = () => {
    if (!blockEditorHome) return;
    blockEditorHome.editor.destroy();
    state.blockEditorView = null;
    blockEditorHome = null;
  };

  const removePendingAdd = () => {
    if (!pendingAdd) return;
    if (blockEditorHome?.instance === pendingAdd.draft.instance) restoreBlockEditorHome();
    pendingAdd.draft.destroy();
    pendingAdd = null;
  };

  const closeDialogs = () => {
    ui.insertOpen = false;
    ui.deleteOpen = false;
    syncModalState();
    render();
  };

  const closeBlockEditorModal = ({ keepSelection = false, refreshPreview = true } = {}) => {
    const wasEditing = ui.blockEditorOpen;
    const changed = state.blockEditorDirty;
    const selectedDescriptor = state.selectedBlock;
    restoreBlockEditorHome();
    ui.blockEditorOpen = false;
    syncModalState();
    render();
    if (!keepSelection) {
      state.selectedBlock = null;
      syncSelectedPageBlockEditor(null);
    }
    state.blockEditorDirty = false;
    if (refreshPreview && wasEditing && changed) {
      preview.refreshBlock(selectedDescriptor, { immediate: true });
    } else if (refreshPreview && !wasEditing) {
      preview.refreshDoc();
    }
    state.richTextToolbar?.update();
  };

  const focusFirst = (container, preferred = null) => {
    window.requestAnimationFrame(() => (preferred || container.querySelector("input, textarea, select, button"))?.focus());
  };

  const streamEditorFor = (descriptor) => state.streamEditors
    .find((item) => item.fieldName === descriptor.fieldName);

  const publishBlockSelection = (descriptor) => {
    state.selectedBlock = descriptor;
    syncSelectedPageBlockEditor(descriptor);
  };

  const mountBlockEditorAt = (descriptor, target, { instance = streamEditorFor(descriptor), publishSelection = true } = {}) => {
    if (!instance || !target) return false;

    restoreBlockEditorHome();
    const editor = createBlockEditor(instance, descriptor, target);
    if (!editor) return false;

    blockEditorHome = { instance, editor };
    if (publishSelection) publishBlockSelection(descriptor);
    window.requestAnimationFrame(() => {
      if (publishSelection) syncSelectedPageBlockEditor(descriptor);
      state.blockEditorView = editor.view;
      editor.updateRoot();
    });
    return true;
  };

  const openBlockEditorModal = (descriptor) => {
    state.blockEditorDirty = false;
    closeDialogs();
    ui.blockEditorOpen = true;
    syncModalState();
    render();
    if (!mountBlockEditorAt(descriptor, refs.blockEditorContent)) {
      ui.blockEditorOpen = false;
      syncModalState();
      render();
      return;
    }
    focusFirst(refs.blockEditorContent);
  };

  const openDialog = (name, focusTarget = null) => {
    preview.cancel();
    if (ui.insertOpen) removePendingAdd();
    ui.insertOpen = name === "insert";
    ui.deleteOpen = name === "delete";
    syncModalState();
    render();
    focusFirst(name === "insert" ? refs.insertDialog : refs.deleteDialog, focusTarget);
  };

  const addSelectedBlockForEditing = () => {
    const active = selectedBlock();
    const blockRoot = active?.blockElement?.getRootNode();
    const anchorBlock = pendingAdd?.anchor && blockRoot ? findPageBlock(blockRoot, pendingAdd.anchor) : active?.blockElement;
    const liveInstance = pendingAdd?.liveInstance || active?.instance;
    if (!liveInstance || !anchorBlock) return;
    ui.blockEditorOpen = false;
    removePendingAdd();
    const insertType = refs.insertSelect.value;
    ui.insertType = insertType;
    const anchor = describePageBlock(anchorBlock);
    const draft = createStreamBlockDraft(liveInstance, insertType);
    const draftBlock = draft.instance.doc.firstChild;
    const descriptor = {
      fieldName: liveInstance.fieldName,
      blockId: draftBlock.attrs?.id || "",
      blockIndex: 0,
    };
    if (mountBlockEditorAt(descriptor, refs.insertEditorBody, {
      instance: draft.instance,
      publishSelection: false,
    })) {
      pendingAdd = { liveInstance, draft, anchor };
      ui.insertOpen = true;
      syncModalState();
    } else {
      draft.destroy();
    }
  };

  const commitInsertDialog = () => {
    if (!pendingAdd) addSelectedBlockForEditing();
    if (!pendingAdd) return;

    const { liveInstance, draft, anchor } = pendingAdd;
    const anchorInfo = topLevelBlockInfoByIdOrIndex(liveInstance.doc, anchor.blockId, anchor.blockIndex);
    if (!anchorInfo) return;

    const block = draft.instance.doc.firstChild;
    const descriptor = {
      fieldName: liveInstance.fieldName,
      blockId: block.attrs?.id || "",
      blockIndex: anchorInfo.index + 1,
    };
    liveInstance.history.stopCapturing();
    insertBlock(liveInstance, { after: anchor, block });
    liveInstance.history.stopCapturing();

    pendingAdd = null;
    restoreBlockEditorHome();
    draft.destroy();
    state.selectedBlock = descriptor;
    state.revealSelectedBlock = descriptor;
    closeDialogs();
    closeBlockEditorModal({ keepSelection: true, refreshPreview: false });
    syncSelectedPageBlockEditor(descriptor);
    preview.refreshDoc({ immediate: true });
  };

  const UIactions = {
    insert() {
      if (!syncActiveBlock()) return;
      ui.insertType = ui.blockTypes.includes("richtext") ? "richtext" : ui.blockTypes[0];
      openDialog("insert", refs.insertSelect);
    },
    edit() {
      const active = syncActiveBlock();
      if (!active || ui.blockType === "richtext") return;
      openBlockEditorModal(active.descriptor);
    },
    delete() {
      if (syncActiveBlock()) openDialog("delete");
    },
    moveUp() {
      const active = selectedBlock();
      if (active) moveBlock(active.instance, active.blockElement, -1);
    },
    moveDown() {
      const active = selectedBlock();
      if (active) moveBlock(active.instance, active.blockElement, 1);
    },
    done() {
      closeBlockEditorModal({ keepSelection: true });
    },
    cancelInsert() {
      removePendingAdd();
      closeDialogs();
      closeBlockEditorModal();
    },
    commitInsert() {
      commitInsertDialog();
    },
    closeDialogs,
    confirmDelete() {
      const active = selectedBlock();
      if (active) {
        active.instance.history.stopCapturing();
        deletePageBlock(active.instance, active.blockElement);
        active.instance.history.stopCapturing();
      }
      closeDialogs();
      preview.refreshDoc({ immediate: true });
    },
    setInsertType(blockType) {
      ui.insertType = blockType;
      const active = selectedBlock();
      if (active) state.preferredInsertTypes.set(active.instance.fieldName, blockType);
      render();
      if (ui.insertOpen) addSelectedBlockForEditing();
    },
  };

  const api = {
    ...UIactions,
    getState() {
      const active = syncActiveBlock();
      if (!active) return { selected: false, upDisabled: true, downDisabled: true, editDisabled: true };
      return {
        selected: true,
        upDisabled: active.info.index === 0,
        downDisabled: active.info.index === active.instance.doc.childCount - 1,
        editDisabled: ui.blockType === "richtext",
      };
    },
    cleanup() {
      if (!mounted) return;
      root.removeEventListener("click", selectClickedBlock, true);
      removePendingAdd();
      restoreBlockEditorHome();
      mounted = false;
      modalRoot.unmount();
      modalMount.remove();
      state.blockEditorModalOpen = false;
      state.blockEditorEditing = false;
    },
  };

  state.blockActions = api;
  render();
  return api;
}
