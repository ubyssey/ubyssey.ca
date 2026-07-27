// Combines components and operations, and connects with state n stuff

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { startCommentOnSelection } from "../annotations/index.js";
import { suggestionModeIsActive, toggleSuggestionMode } from "../rich_text/index.jsx";
import { blockTypeLabel, deleteTopLevelBlock, topLevelBlockInfoByIdOrIndex } from "../stream/index.jsx";
import { manuscriptSession } from "../session.js";
import { ArticleBlockControlsLayer, ArticleBlockModals } from "./components.jsx";
import {
  cleanupArticleBlockControls,
  clearSuppressedHover,
  collectBlockCommentThreads,
  deleteArticleBlock,
  describeArticleBlock,
  findArticleBlock,
  insertBlockAfter,
  moveArticleBlock,
  refreshBlockCommentBorders,
  selectArticleBlockElement,
  showSelectedArticleBlockEditor,
  streamBlockInfoForArticleBlock,
  updateBlockCommentThread,
} from "./operations.js";

export {
  articleBlockDescriptors,
  cleanupArticleBlockControls,
  collectBlockCommentThreads,
  describeArticleBlock,
  findArticleBlock,
  refreshBlockCommentBorders,
  sameArticleBlock,
  selectArticleBlock,
  setupArticleBlockKeyboard,
  showSelectedArticleBlockEditor,
} from "./operations.js";

const ARTICLE_BLOCK_SELECTOR = "[data-article-block][data-stream-field]";
const FOCUSABLE = "input, textarea, select, button";

const eventInside = (event, elements) => {
  const path = event.composedPath?.() || [];
  return elements.some((item) => path.includes(item));
};

function focusFirst(root, preferred = null) {
  window.requestAnimationFrame(() => {
    (preferred || root.querySelector(FOCUSABLE)).focus();
  });
}

// Entire thing is basically this function
export function setupArticleBlockControls(manuscriptRoot) {
  if (!manuscriptRoot) return;

  cleanupArticleBlockControls();
  manuscriptRoot.querySelectorAll(".pm-article-block-controls-layer").forEach((element) => { element.remove(); });
  if (!manuscriptRoot.querySelector(ARTICLE_BLOCK_SELECTOR)) return;

  const controlsHost = manuscriptRoot.querySelector(".article-shadow-preview");
  if (!controlsHost) return;

  const layer = document.createElement("div");
  layer.className = "pm-article-block-controls-layer";
  controlsHost.appendChild(layer);

  const modalMount = document.createElement("div");
  const manuscriptForm = document.querySelector("[data-manuscript-form]");
  (manuscriptForm || document.body).appendChild(modalMount);

  const layerRoot = createRoot(layer);
  const modalRoot = createRoot(modalMount);
  const refs = {
    controlsWrapper: null,
    topControls: null,
    blockEditorContent: null,
    insertEditorBody: null,
    insertSelect: null,
    insertDialog: null,
    deleteDialog: null,
    blockEditorModal: null,
  };
  const ui = {
    blockTypes: [],
    blockType: "",
    fieldName: "",
    insertType: "",
    blockEditorOpen: false,
    insertOpen: false,
    deleteOpen: false,
    upDisabled: true,
    downDisabled: true,
    suggestionMode: suggestionModeIsActive(),
  };

  let blockEditorHome = null;
  let pendingAdd = null;
  let state = null;
  let mounted = true;
  let pointerPosition = null;

  const controls = () => [refs.topControls].filter(Boolean);
  const dialogs = () => [refs.insertDialog, refs.deleteDialog].filter(Boolean);
  const anyBlockModalOpen = () => ui.blockEditorOpen || ui.insertOpen || ui.deleteOpen;
  const syncBlockModalOpenState = () => {
    manuscriptSession.blockEditorModalOpen = anyBlockModalOpen();
  };
  const isDialogOpen = () => ui.insertOpen || ui.deleteOpen;
  const withActiveBlock = (callback) => {
    const active = manuscriptSession.articleBlockControls;
    if (active.instance && active.articleBlock) callback(active.instance, active.articleBlock);
  };

  const render = () => {
    if (!mounted) return;

    flushSync(() => {
      layerRoot.render(
        <ArticleBlockControlsLayer
          refs={refs}
          ui={ui}
          actions={actions}
        />,
      );
      modalRoot.render(
        <ArticleBlockModals
          refs={refs}
          ui={ui}
          actions={actions}
        />,
      );
    });
  };

  const closeDialogs = () => {
    ui.insertOpen = false;
    ui.deleteOpen = false;
    syncBlockModalOpenState();
    render();
  };

  const removePendingAdd = () => {
    if (!pendingAdd) return;
    const info = topLevelBlockInfoByIdOrIndex(
      pendingAdd.instance.view.state.doc,
      pendingAdd.descriptor.blockId,
      pendingAdd.descriptor.blockIndex,
    );
    if (info) deleteTopLevelBlock(pendingAdd.instance.view, info);
    pendingAdd = null;
  };

  const editorSectionForDescriptor = (descriptor) => {
    const instance = manuscriptSession.streamEditors.find((item) => item.fieldName === descriptor.fieldName);
    const section = instance.mount.closest(".editor-section");
    return section ? { instance, section } : null;
  };

  const restoreBlockEditorHome = () => {
    if (blockEditorHome) {
      blockEditorHome.parent.insertBefore(blockEditorHome.section, blockEditorHome.nextSibling);
      blockEditorHome.instance.view.updateRoot();
      blockEditorHome = null;
    }
  };

  const closeBlockEditorModal = ({ keepSelection = false, refreshPreview = true } = {}) => {
    restoreBlockEditorHome();
    ui.blockEditorOpen = false;
    syncBlockModalOpenState();
    render();
    if (!keepSelection) {
      manuscriptSession.selectedArticleBlock = null;
      showSelectedArticleBlockEditor(null);
    }
    if (refreshPreview) manuscriptSession.schedulePreview();
  };

  const cancelInsertDialog = () => {
    removePendingAdd();
    closeDialogs();
    closeBlockEditorModal();
  };

  const moveBlockEditorTo = (descriptor, target) => {
    const editorSection = editorSectionForDescriptor(descriptor);
    if (!editorSection) return false;

    if (blockEditorHome && blockEditorHome.section !== editorSection.section) restoreBlockEditorHome();
    if (!blockEditorHome) {
      blockEditorHome = {
        instance: editorSection.instance,
        section: editorSection.section,
        parent: editorSection.section.parentNode,
        nextSibling: editorSection.section.nextSibling,
      };
    }

    manuscriptSession.selectedArticleBlock = descriptor;
    target.appendChild(editorSection.section);
    editorSection.instance.view.updateRoot();
    showSelectedArticleBlockEditor(descriptor);
    window.requestAnimationFrame(() => {
      showSelectedArticleBlockEditor(descriptor);
      editorSection.instance.view.updateRoot();
    });
    syncBlockModalOpenState();
    return true;
  };

  const openBlockEditorModal = (descriptor) => {
    closeDialogs();
    restoreBlockEditorHome();
    ui.blockEditorOpen = true;
    syncBlockModalOpenState();
    render();

    if (!moveBlockEditorTo(descriptor, refs.blockEditorContent)) {
      ui.blockEditorOpen = false;
      syncBlockModalOpenState();
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
    syncBlockModalOpenState();
    render();
    focusFirst(name === "insert" ? refs.insertDialog : refs.deleteDialog, focusTarget);
  };

  const addSelectedBlockForEditing = () => {
    const active = manuscriptSession.articleBlockControls;
    const root = active.articleBlock && active.articleBlock.getRootNode();
    const anchorBlock = (
      pendingAdd && pendingAdd.anchor && root && findArticleBlock(root, pendingAdd.anchor)
    ) || active.articleBlock;
    const instance = (pendingAdd && pendingAdd.instance) || active.instance;
    if (!instance || !anchorBlock) return;

    restoreBlockEditorHome();
    ui.blockEditorOpen = false;
    removePendingAdd();

    const anchor = describeArticleBlock(anchorBlock);
    const descriptor = insertBlockAfter(instance, anchorBlock, ui.insertType, { keepControls: true });
    if (descriptor && moveBlockEditorTo(descriptor, refs.insertEditorBody)) {
      pendingAdd = { instance, descriptor, anchor };
      ui.insertOpen = true;
      syncBlockModalOpenState();
    }
  };

  const commitInsertDialog = () => {
    if (!pendingAdd) addSelectedBlockForEditing();
    if (!pendingAdd) return;

    const historyView = pendingAdd.instance.view;
    manuscriptSession.revealSelectedArticleBlock = pendingAdd.descriptor;
    pendingAdd = null;
    closeDialogs();
    closeBlockEditorModal({ keepSelection: true, refreshPreview: false });
    manuscriptSession.richTextToolbar?.setHistoryView(historyView);
    manuscriptSession.schedulePreview({ immediate: true });
  };

  const commentOnActiveBlock = (instance, articleBlock) => {
    const selectedTextEditor = [
      ...manuscriptSession.articleRichTextEditors,
      ...manuscriptSession.articleDirectTextEditors,
    ].find(({ view }) => (
      view.state.schema.marks.comment &&
      !view.state.selection.empty &&
      (articleBlock === view.dom || articleBlock.contains(view.dom))
    ));

    if (selectedTextEditor) {
      const started = startCommentOnSelection(selectedTextEditor.view);
      if (started) {
        selectedTextEditor.view.focus();
        manuscriptSession.commentSidebar.update();
        manuscriptSession.footnoteSidebar.update();
        return;
      }
    }

    const descriptor = describeArticleBlock(articleBlock);
    const info = topLevelBlockInfoByIdOrIndex(instance.view.state.doc, descriptor.blockId, descriptor.blockIndex);

    selectArticleBlockElement(articleBlock);
    const currentComments = blockCommentsForNode(info.node);
    const existingPending = currentComments.find((thread) => thread.pending);
    const nextComments = existingPending ? currentComments : [
      ...currentComments,
      {
        threadId: crypto.randomUUID(),
        comments: [],
        pending: true,
        resolved: false,
      },
    ];
    updateStreamBlockAttrs(instance, info, { blockComments: nextComments });
    refreshBlockCommentBorders(articleBlock.getRootNode());
    manuscriptSession.commentSidebar.update();
  };

  const actions = {
    insert() {
      ui.insertType = ui.blockTypes.includes("richtext") ? "richtext" : ui.blockTypes[0];
      openDialog("insert", refs.insertSelect);
    },
    edit() {
      withActiveBlock((instance, articleBlock) => {
        openBlockEditorModal(describeArticleBlock(articleBlock));
      });
    },
    comment() {
      withActiveBlock(commentOnActiveBlock);
    },
    toggleSuggestion() {
      ui.suggestionMode = toggleSuggestionMode();
      render();
      manuscriptSession.richTextToolbar?.update();
    },
    delete() {
      openDialog("delete");
    },
    moveUp() {
      withActiveBlock((instance, articleBlock) => { moveArticleBlock(instance, articleBlock, -1); });
    },
    moveDown() {
      withActiveBlock((instance, articleBlock) => { moveArticleBlock(instance, articleBlock, 1); });
    },
    done() {
      closeBlockEditorModal({ keepSelection: true });
    },
    cancelInsert() {
      cancelInsertDialog();
    },
    commitInsert() {
      commitInsertDialog();
    },
    closeDialogs() {
      closeDialogs();
    },
    confirmDelete() {
      withActiveBlock((instance, articleBlock) => {
        deleteArticleBlock(instance, articleBlock);
      });
      closeDialogs();
      manuscriptSession.schedulePreview({ immediate: true });
    },
    setInsertType(blockType) {
      ui.insertType = blockType;
      if (state.instance) manuscriptSession.preferredInsertTypes.set(state.instance.fieldName, blockType);
      render();
      if (ui.insertOpen) addSelectedBlockForEditing();
    },
  };

  render();

  state = {
    articleBlock: null,
    instance: null,

    cleanup() {
      if (!mounted) return;

      for (const [target, eventName, listener, options] of listeners) {
        target.removeEventListener(eventName, listener, options);
      }
      removePendingAdd();
      closeDialogs();
      closeBlockEditorModal({ keepSelection: true, refreshPreview: false });
      mounted = false;
      layerRoot.unmount();
      modalRoot.unmount();
      modalMount.remove();
      layer.remove();
    },

    hide() {
      if (!mounted || anyBlockModalOpen()) return;

      this.articleBlock = null;
      this.instance = null;
      closeDialogs();
      layer.classList.remove("is-active");
    },

    setActive(articleBlock) {
      if (!mounted) return;

      const instance = manuscriptSession.streamEditors.find((item) => item.fieldName === articleBlock.dataset.streamField);
      const info = instance && streamBlockInfoForArticleBlock(instance, articleBlock);
      if (!instance || !info) {
        this.hide();
        return;
      }

      this.articleBlock = articleBlock;
      this.instance = instance;
      fillInsertTypes(instance);
      ui.blockType = info.node.attrs.blockType;
      ui.fieldName = instance.fieldName;
      ui.upDisabled = info.index === 0;
      ui.downDisabled = info.index === instance.view.state.doc.childCount - 1;
      ui.suggestionMode = suggestionModeIsActive();
      render();
      positionControls();
    },
  };

  const fillInsertTypes = (instance) => {
    const blockTypes = instance.availableBlockTypes;
    const preferredValue = manuscriptSession.preferredInsertTypes.get(instance.fieldName);
    const currentValue = ui.insertType;
    const nextValue = [preferredValue, currentValue, blockTypes[0]].find((value) => value && blockTypes.includes(value));

    ui.blockTypes = blockTypes;
    ui.insertType = nextValue;
    manuscriptSession.preferredInsertTypes.set(instance.fieldName, nextValue);
  };

  const positionBlockControlsWrapper = (target, left, top, width, height, padding = 6) => {
    const maxLeft = Math.max(padding, controlsHost.clientWidth - width - padding);
    const nextLeft = Math.max(padding, Math.min(left, maxLeft));
    Object.assign(target.style, { left: nextLeft + "px", top: top + "px", height: height + "px" });
  };

  function positionControls() {
    if (!state.articleBlock) return;

    const rect = state.articleBlock.getBoundingClientRect();
    const hostRect = controlsHost.getBoundingClientRect();
    if (!rect.width || !rect.height || !hostRect.width || !hostRect.height) {
      state.hide();
      return;
    }

    const padding = 6;
    const blockLeft = rect.left - hostRect.left + controlsHost.scrollLeft;
    const blockTop = rect.top - hostRect.top + controlsHost.scrollTop;
    layer.classList.add("is-active");
    const controlsHeight = refs.topControls.offsetHeight;
    const controlsTop = Math.min(blockTop + 8, window.innerHeight - controlsHeight - padding - hostRect.top + controlsHost.scrollTop);
    const topbarBottom = document.querySelector(".manuscript-topbar")?.getBoundingClientRect().bottom || 0;
    const toolbarBottom = manuscriptRoot.querySelector(".pm-manuscript-toolbar:not(:empty)")?.getBoundingClientRect().bottom || 0;
    refs.topControls.style.setProperty("--pm-article-block-controls-top", Math.max(topbarBottom, toolbarBottom) + padding + "px");
    positionBlockControlsWrapper(
      refs.controlsWrapper,
      blockLeft + rect.width + 8,
      controlsTop,
      refs.topControls.offsetWidth,
      Math.max(blockTop + rect.height - controlsTop, controlsHeight),
      padding,
    );
  }

  const eventInsideDirectEdit = (event) => event.composedPath()
    .some((target) => target.matches && target.matches(".pm-manuscript-direct-edit, .pm-manuscript-direct-edit *"));
  const articleBlockAtPoint = ({ x, y }) => controlsHost.getRootNode()
    .elementFromPoint(x, y)?.closest(ARTICLE_BLOCK_SELECTOR);
  const articleBlockFromEvent = (event) => {
    const fromPath = event.composedPath()
      .map((target) => target.closest && target.closest(ARTICLE_BLOCK_SELECTOR))
      .find(Boolean);
    const fromPoint = Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
      ? articleBlockAtPoint({ x: event.clientX, y: event.clientY })
      : null;
    return fromPath || fromPoint;
  };

  const showFromEvent = (event, shouldSelect = false) => {
    if (eventInside(event, controls())) {
      return;
    }

    if (isDialogOpen()) {
      if (!shouldSelect) return;
      if (ui.insertOpen) cancelInsertDialog();
      else closeDialogs();
    }

    const articleBlock = articleBlockFromEvent(event);
    if (!articleBlock) return;

    if (!shouldSelect && articleBlock === manuscriptSession.suppressedHoverArticleBlock) return;
    if (shouldSelect || articleBlock !== manuscriptSession.suppressedHoverArticleBlock) clearSuppressedHover();

    state.setActive(articleBlock);
    if (shouldSelect) selectArticleBlockElement(articleBlock);
  };

  const onOver = (event) => {
    pointerPosition = { x: event.clientX, y: event.clientY };
    if (!isDialogOpen()) showFromEvent(event);
  };
  const onFocusIn = (event) => {
    if (eventInsideDirectEdit(event)) return;
    if (isDialogOpen() && eventInside(event, dialogs())) return;
    showFromEvent(event, true);
  };
  const onClick = (event) => {
    if (eventInside(event, controls()) || eventInsideDirectEdit(event)) return;
    if (ui.insertOpen) cancelInsertDialog();
    else if (isDialogOpen()) closeDialogs();
    showFromEvent(event, true);
  };
  const onOut = (event) => {
    if (!manuscriptRoot.contains(event.relatedTarget)) pointerPosition = null;
    if (isDialogOpen()) return;
    if (manuscriptSession.suppressedHoverArticleBlock && manuscriptSession.suppressedHoverArticleBlock.contains(event.target) && !manuscriptSession.suppressedHoverArticleBlock.contains(event.relatedTarget)) {
      clearSuppressedHover();
    }
  };
  const onKeyDown = (event) => {
    if (event.key !== "Escape") return;
    if (ui.insertOpen) cancelInsertDialog();
    else closeDialogs();
  };
  const onScroll = () => {
    if (!pointerPosition || isDialogOpen()) return;

    const articleBlock = articleBlockAtPoint(pointerPosition);
    if (!articleBlock || articleBlock === state.articleBlock || articleBlock === manuscriptSession.suppressedHoverArticleBlock) return;

    clearSuppressedHover();
    state.setActive(articleBlock);
  };
  const listeners = [
    [manuscriptRoot, "mouseover", onOver],
    [manuscriptRoot, "pointermove", onOver],
    [manuscriptRoot, "focusin", onFocusIn],
    [manuscriptRoot, "click", onClick],
    [manuscriptRoot, "mouseout", onOut],
    [document, "keydown", onKeyDown],
    [window, "resize", positionControls],
    [document, "scroll", onScroll, true],
  ];

  for (const [target, eventName, listener, options] of listeners) {
    target.addEventListener(eventName, listener, options);
  }

  manuscriptSession.articleBlockControls = state;
  refreshBlockCommentBorders(manuscriptRoot);
}
