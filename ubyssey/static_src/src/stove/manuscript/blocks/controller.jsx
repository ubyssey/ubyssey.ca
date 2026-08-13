// Selected article-block actions

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { createStreamBlockDraft, topLevelBlockInfoByIdOrIndex } from "../stream/index.jsx";
import { manuscriptSession } from "../session.js";
import { ArticleBlockModals } from "./components.jsx";
import {
  deleteArticleBlock,
  describeArticleBlock,
  findArticleBlock,
  moveArticleBlock,
  selectArticleBlockElement,
  streamBlockInfoForArticleBlock,
  syncSelectedArticleBlockEditor,
} from "./operations.js";

export {
  articleBlocksForStreamField,
  articleBlockDescriptors,
  collectBlockCommentThreads,
  describeArticleBlock,
  findArticleBlock,
  refreshBlockCommentBorders,
  sameArticleBlock,
  selectArticleBlock,
  selectArticleBlockElement,
  setupArticleBlockKeyboard,
  syncSelectedArticleBlockEditor,
} from "./operations.js";

export function setupArticleBlockActions(manuscriptRoot) {
  if (!manuscriptRoot) return null;
  manuscriptSession.articleBlockActions?.cleanup();
  manuscriptSession.articleBlockActions = null;

  const modalMount = document.createElement("div");
  const manuscriptForm = document.querySelector("[data-manuscript-form]");
  (manuscriptForm || document.body).appendChild(modalMount);

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
      modalRoot.render(<ArticleBlockModals refs={refs} ui={ui} actions={actions} />);
    });
  };

  const selectClickedBlock = (event) => {
    const ARTICLE_BLOCK_SELECTOR = "[data-article-block][data-stream-field]";
    let articleBlock = event.composedPath().map((target) => target.closest?.(ARTICLE_BLOCK_SELECTOR)).find(Boolean);
    if (!articleBlock) return;

    let parentBlock = articleBlock.parentElement?.closest(ARTICLE_BLOCK_SELECTOR);

    while (parentBlock && manuscriptRoot.contains(parentBlock)) {
      articleBlock = parentBlock;
      parentBlock = articleBlock.parentElement?.closest(ARTICLE_BLOCK_SELECTOR);
    }
    selectArticleBlockElement(articleBlock);
  };
  manuscriptRoot.addEventListener("click", selectClickedBlock, true);

  const syncModalState = () => {
    manuscriptSession.blockEditorModalOpen = ui.blockEditorOpen || ui.insertOpen || ui.deleteOpen;
    manuscriptSession.blockEditorEditing = ui.blockEditorOpen;
  };

  const selectedBlock = () => {
    const descriptor = manuscriptSession.selectedArticleBlock;
    if (!descriptor) return null;
    const articleBlock = findArticleBlock(manuscriptRoot, descriptor);
    const instance = articleBlock && manuscriptSession.streamEditors
      .find((item) => item.fieldName === descriptor.fieldName);
    const info = instance && streamBlockInfoForArticleBlock(instance, articleBlock);
    return instance && info ? { descriptor, articleBlock, instance, info } : null;
  };

  const fillInsertTypes = (instance) => {
    const blockTypes = instance.availableBlockTypes;
    const preferredValue = manuscriptSession.preferredInsertTypes.get(instance.fieldName);
    const nextValue = [preferredValue, ui.insertType, blockTypes[0]]
      .find((value) => value && blockTypes.includes(value));
    ui.blockTypes = blockTypes;
    ui.insertType = nextValue;
    manuscriptSession.preferredInsertTypes.set(instance.fieldName, nextValue);
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
    blockEditorHome.instance.unmountEditor();
    blockEditorHome.parent.insertBefore(blockEditorHome.section, blockEditorHome.nextSibling);
    blockEditorHome = null;
  };

  const removePendingAdd = () => {
    if (!pendingAdd) return;
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
    const changed = manuscriptSession.blockEditorDirty;
    restoreBlockEditorHome();
    ui.blockEditorOpen = false;
    syncModalState();
    render();
    if (!keepSelection) {
      manuscriptSession.selectedArticleBlock = null;
      syncSelectedArticleBlockEditor(null);
    }
    manuscriptSession.blockEditorDirty = false;
    if (refreshPreview && wasEditing && changed) {
      manuscriptSession.schedulePreview({ blockOnly: true, immediate: true });
    } else if (refreshPreview && !wasEditing) {
      manuscriptSession.schedulePreview();
    }
    manuscriptSession.richTextToolbar?.update();
  };

  const focusFirst = (root, preferred = null) => {
    window.requestAnimationFrame(() => (preferred || root.querySelector("input, textarea, select, button"))?.focus());
  };

  const moveBlockEditorTo = (descriptor, target, options = {}) => {
    const { instance: suppliedInstance = null, publishSelection = true } = options;
    const instance = suppliedInstance || manuscriptSession.streamEditors
      .find((item) => item.fieldName === descriptor.fieldName);
    const section = instance?.mount.closest(".editor-section");
    if (!instance || !section || !target) return false;
    if (blockEditorHome && blockEditorHome.section !== section) restoreBlockEditorHome();
    if (!blockEditorHome) {
      blockEditorHome = { instance, section, parent: section.parentNode, nextSibling: section.nextSibling };
    }
    if (publishSelection) manuscriptSession.selectedArticleBlock = descriptor;
    target.appendChild(section);
    instance.mountEditor().updateRoot();
    if (publishSelection) syncSelectedArticleBlockEditor(descriptor);
    window.requestAnimationFrame(() => {
      if (publishSelection) syncSelectedArticleBlockEditor(descriptor);
      instance.view?.updateRoot();
    });
    return true;
  };

  const openBlockEditorModal = (descriptor) => {
    manuscriptSession.blockEditorDirty = false;
    closeDialogs();
    restoreBlockEditorHome();
    ui.blockEditorOpen = true;
    syncModalState();
    render();
    if (!moveBlockEditorTo(descriptor, refs.blockEditorContent)) {
      ui.blockEditorOpen = false;
      syncModalState();
      render();
      return;
    }
    focusFirst(refs.blockEditorContent);
  };

  const openDialog = (name, focusTarget = null) => {
    manuscriptSession.cancelPreviewRefresh();
    if (ui.insertOpen) removePendingAdd();
    ui.insertOpen = name === "insert";
    ui.deleteOpen = name === "delete";
    syncModalState();
    render();
    focusFirst(name === "insert" ? refs.insertDialog : refs.deleteDialog, focusTarget);
  };

  const addSelectedBlockForEditing = () => {
    const active = selectedBlock();
    const root = active?.articleBlock?.getRootNode();
    const anchorBlock = pendingAdd?.anchor && root ? findArticleBlock(root, pendingAdd.anchor) : active?.articleBlock;
    const liveInstance = pendingAdd?.liveInstance || active?.instance;
    if (!liveInstance || !anchorBlock) return;
    restoreBlockEditorHome();
    ui.blockEditorOpen = false;
    removePendingAdd();
    const anchor = describeArticleBlock(anchorBlock);
    const draft = createStreamBlockDraft(liveInstance, ui.insertType);
    const draftBlock = draft.instance.doc.firstChild;
    const descriptor = {
      fieldName: liveInstance.fieldName,
      blockId: draftBlock.attrs?.id || "",
      blockIndex: 0,
    };
    if (moveBlockEditorTo(descriptor, refs.insertEditorBody, {
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
    liveInstance.updateDoc((transaction) => transaction.insert(anchorInfo.end, block));

    pendingAdd = null;
    restoreBlockEditorHome();
    draft.destroy();
    manuscriptSession.selectedArticleBlock = descriptor;
    manuscriptSession.revealSelectedArticleBlock = descriptor;
    closeDialogs();
    closeBlockEditorModal({ keepSelection: true, refreshPreview: false });
    syncSelectedArticleBlockEditor(descriptor);
    manuscriptSession.schedulePreview({ immediate: true });
  };

  const actions = {
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
      if (active) moveArticleBlock(active.instance, active.articleBlock, -1);
    },
    moveDown() {
      const active = selectedBlock();
      if (active) moveArticleBlock(active.instance, active.articleBlock, 1);
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
      if (active) deleteArticleBlock(active.instance, active.articleBlock);
      closeDialogs();
      manuscriptSession.schedulePreview({ immediate: true });
    },
    setInsertType(blockType) {
      ui.insertType = blockType;
      const active = selectedBlock();
      if (active) manuscriptSession.preferredInsertTypes.set(active.instance.fieldName, blockType);
      render();
      if (ui.insertOpen) addSelectedBlockForEditing();
    },
  };

  const api = {
    ...actions,
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
      manuscriptRoot.removeEventListener("click", selectClickedBlock, true);
      removePendingAdd();
      restoreBlockEditorHome();
      mounted = false;
      modalRoot.unmount();
      modalMount.remove();
      manuscriptSession.blockEditorModalOpen = false;
      manuscriptSession.blockEditorEditing = false;
    },
  };

  manuscriptSession.articleBlockActions = api;
  render();
  return api;
}
