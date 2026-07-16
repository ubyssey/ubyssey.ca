// Deals with block level controls -> Select, Move, Edit, Delete
// manuscript_document deals with document level stuff like shadow dom/preview and direct inline editing

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { startCommentOnSelection } from "./manuscript_annotations.jsx";
import { suggestionModeIsActive, toggleSuggestionMode } from "./manuscript_prosemirror.jsx";
import { blockTypeLabel, createStreamBlockNode, deleteTopLevelBlock, moveTopLevelBlock, topLevelBlockInfoByIdOrIndex } from "./manuscript_prosetail.jsx";
import { editorState } from "./manuscript_editor.js";

const ARTICLE_BLOCK_SELECTOR = "[data-article-block][data-stream-field]";
const ARTICLE_STREAM_FIELDS = new Set(["header", "content"]);
const ARTICLE_KEY_DIRECTIONS = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};

const FOCUSABLE = "input, textarea, select, button";

const targetInside = (target, elements) => Boolean(target && elements.some((item) => item.contains(target)));
const eventInside = (event, elements) => {
  const path = event.composedPath?.() || [];
  return elements.some((item) => path.includes(item));
};

function focusFirst(root, preferred = null) {
  window.requestAnimationFrame(() => {
    (preferred || root.querySelector(FOCUSABLE)).focus();
  });
}

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

  const controls = () => [refs.topControls].filter(Boolean);
  const dialogs = () => [refs.insertDialog, refs.deleteDialog].filter(Boolean);
  const anyBlockModalOpen = () => ui.blockEditorOpen || ui.insertOpen || ui.deleteOpen;
  const syncBlockModalOpenState = () => {
    editorState.blockEditorModalOpen = anyBlockModalOpen();
  };
  const isDialogOpen = () => ui.insertOpen || ui.deleteOpen;
  const withActiveBlock = (callback) => {
    const active = editorState.articleBlockControls;
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
    const instance = editorState.streamEditors.find((item) => item.fieldName === descriptor.fieldName);
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
      editorState.selectedArticleBlock = null;
      showSelectedArticleBlockEditor(null);
    }
    if (refreshPreview) editorState.schedulePreview();
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

    editorState.selectedArticleBlock = descriptor;
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
    clearTimeout(state.hideTimer);
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
    clearTimeout(state.hideTimer);
    editorState.cancelPreviewRefresh();
    if (ui.insertOpen) removePendingAdd();
    ui.insertOpen = name === "insert";
    ui.deleteOpen = name === "delete";
    syncBlockModalOpenState();
    render();
    focusFirst(name === "insert" ? refs.insertDialog : refs.deleteDialog, focusTarget);
  };

  const addSelectedBlockForEditing = () => {
    const active = editorState.articleBlockControls;
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

    editorState.revealSelectedArticleBlock = pendingAdd.descriptor;
    pendingAdd = null;
    closeDialogs();
    closeBlockEditorModal({ keepSelection: true, refreshPreview: false });
    editorState.schedulePreview({ immediate: true });
  };

  const commentOnActiveBlock = (instance, articleBlock) => {
    const selectedTextEditor = [
      ...editorState.articleRichTextEditors,
      ...editorState.articleDirectTextEditors,
    ].find(({ view }) => (
      view.state.schema.marks.comment &&
      !view.state.selection.empty &&
      (articleBlock === view.dom || articleBlock.contains(view.dom))
    ));

    if (selectedTextEditor) {
      const started = startCommentOnSelection(selectedTextEditor.view);
      if (started) {
        selectedTextEditor.view.focus();
        editorState.commentSidebar.update();
        editorState.footnoteSidebar.update();
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
    editorState.commentSidebar.update();
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
      editorState.richTextToolbar?.update();
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
        closeDialogs();
      });
    },
    setInsertType(blockType) {
      ui.insertType = blockType;
      if (state.instance) editorState.preferredInsertTypes.set(state.instance.fieldName, blockType);
      render();
      if (ui.insertOpen) addSelectedBlockForEditing();
    },
  };

  render();

  state = {
    articleBlock: null,
    instance: null,
    hideTimer: null,

    cleanup() {
      if (!mounted) return;

      clearTimeout(this.hideTimer);
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

      clearTimeout(this.hideTimer);
      this.articleBlock = null;
      this.instance = null;
      closeDialogs();
      layer.classList.remove("is-active");
    },

    setActive(articleBlock) {
      if (!mounted) return;

      const instance = editorState.streamEditors.find((item) => item.fieldName === articleBlock.dataset.streamField);
      const info = instance && streamBlockInfoForArticleBlock(instance, articleBlock);
      if (!instance || !info) {
        this.hide();
        return;
      }

      clearTimeout(this.hideTimer);
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
    const preferredValue = editorState.preferredInsertTypes.get(instance.fieldName);
    const currentValue = ui.insertType;
    const nextValue = [preferredValue, currentValue, blockTypes[0]].find((value) => value && blockTypes.includes(value));

    ui.blockTypes = blockTypes;
    ui.insertType = nextValue;
    editorState.preferredInsertTypes.set(instance.fieldName, nextValue);
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
    const topbarBottom = document.querySelector(".manuscript-topbar")?.getBoundingClientRect().bottom || 0;
    const toolbarBottom = manuscriptRoot.querySelector(".pm-manuscript-toolbar:not(:empty)")?.getBoundingClientRect().bottom || 0;
    refs.topControls.style.setProperty("--pm-article-block-controls-top", Math.max(topbarBottom, toolbarBottom) + padding + "px");
    positionBlockControlsWrapper(
      refs.controlsWrapper,
      blockLeft + rect.width + 8,
      blockTop + 8,
      refs.topControls.offsetWidth,
      Math.max(rect.height - 8, controlsHeight),
      padding,
    );
  }

  const insideActiveArea = (target) => targetInside(target, controls()) || Boolean(state.articleBlock && state.articleBlock.contains(target));
  const eventInsideDirectEdit = (event) => event.composedPath()
    .some((target) => target.matches && target.matches(".pm-manuscript-direct-edit, .pm-manuscript-direct-edit *"));
  const articleBlockFromEvent = (event) => {
    const fromPath = event.composedPath()
      .map((target) => target.closest && target.closest(ARTICLE_BLOCK_SELECTOR))
      .find(Boolean);
    const fromPoint = Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
      ? controlsHost.getRootNode().elementFromPoint(event.clientX, event.clientY).closest(ARTICLE_BLOCK_SELECTOR)
      : null;
    return fromPath || fromPoint;
  };

  const showFromEvent = (event, shouldSelect = false) => {
    if (eventInside(event, controls())) {
      clearTimeout(state.hideTimer);
      return;
    }

    if (isDialogOpen()) {
      if (!shouldSelect) return;
      if (ui.insertOpen) cancelInsertDialog();
      else closeDialogs();
    }

    const articleBlock = articleBlockFromEvent(event);
    if (!articleBlock) return;

    if (!shouldSelect && articleBlock === editorState.suppressedHoverArticleBlock) return;
    if (shouldSelect || articleBlock !== editorState.suppressedHoverArticleBlock) clearSuppressedHover();

    state.setActive(articleBlock);
    if (shouldSelect) selectArticleBlockElement(articleBlock);
  };

  const scheduleHide = () => {
    if (!mounted || anyBlockModalOpen()) return;
    clearTimeout(state.hideTimer);
    state.hideTimer = setTimeout(() => {
      if (!anyBlockModalOpen() && !insideActiveArea(manuscriptRoot.activeElement)) state.hide();
    }, 120);
  };

  const onOver = (event) => {
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
    if (isDialogOpen()) return;
    if (editorState.suppressedHoverArticleBlock && editorState.suppressedHoverArticleBlock.contains(event.target) && !editorState.suppressedHoverArticleBlock.contains(event.relatedTarget)) {
      clearSuppressedHover();
    }
    if (insideActiveArea(event.target) && !insideActiveArea(event.relatedTarget)) scheduleHide();
  };
  const onFocusOut = () => {
    if (!isDialogOpen()) setTimeout(scheduleHide, 0);
  };
  const onKeyDown = (event) => {
    if (event.key !== "Escape") return;
    if (ui.insertOpen) cancelInsertDialog();
    else closeDialogs();
  };
  const listeners = [
    [manuscriptRoot, "mouseover", onOver],
    [manuscriptRoot, "pointermove", onOver],
    [manuscriptRoot, "focusin", onFocusIn],
    [manuscriptRoot, "click", onClick],
    [manuscriptRoot, "mouseout", onOut],
    [manuscriptRoot, "focusout", onFocusOut],
    [document, "keydown", onKeyDown],
    [window, "resize", positionControls],
  ];

  for (const [target, eventName, listener, options] of listeners) {
    target.addEventListener(eventName, listener, options);
  }

  editorState.articleBlockControls = state;
  refreshBlockCommentBorders(manuscriptRoot);
}

function ArticleBlockControlsLayer({ refs, ui, actions }) {
  return (
    <div ref={(element) => { refs.controlsWrapper = element; }} className="pm-article-block-controls-wrapper">
      <div
        ref={(element) => { refs.topControls = element; }}
        className="pm-article-block-controls pm-article-block-controls--top"
        onClick={(event) => { event.stopPropagation(); }}
        onMouseDown={(event) => { event.stopPropagation(); }}
        onPointerDown={(event) => { event.stopPropagation(); }}
        onMouseUp={(event) => { event.stopPropagation(); }}
        onChange={(event) => { event.stopPropagation(); }}
        onInput={(event) => { event.stopPropagation(); }}
      >
        <button type="button" title="Delete" className="pm-article-block-controls__button pm-article-block-controls__button--danger" onClick={actions.delete}>X</button>
        <button type="button" title="Move up" className="pm-article-block-controls__button pm-article-block-controls__button--move pm-article-block-controls__button--up" disabled={ui.upDisabled} onClick={actions.moveUp} />
        <button type="button" title="Move down" className="pm-article-block-controls__button pm-article-block-controls__button--move pm-article-block-controls__button--down" disabled={ui.downDisabled} onClick={actions.moveDown} />
        <button type="button" title="Comment" className="pm-article-block-controls__button pm-article-block-controls__button--comment" onClick={actions.comment}>💬</button>
        <button type="button" title="Toggle suggestion mode" className="pm-article-block-controls__button pm-article-block-controls__button--suggestion" aria-pressed={String(ui.suggestionMode)} onClick={actions.toggleSuggestion}>Suggest</button>
        {ui.blockType !== "richtext" && <button type="button" title="Edit block" className="pm-article-block-controls__button pm-article-block-controls__button--edit" onClick={actions.edit}>Edit</button>}
        <button type="button" title="Add block" className="pm-article-block-controls__button pm-article-block-controls__button--insert" onClick={actions.insert}>+</button>
      </div>
    </div>
  );
}

function ArticleBlockModals({ refs, ui, actions }) {
  return (
    <>
      <ArticleBlockModal
        modalRef={(element) => { refs.blockEditorModal = element; }}
        open={ui.blockEditorOpen}
        title={`Edit ${blockTypeLabel(ui.blockType)} block`}
        closeLabel="Close block editor"
        onClose={actions.done}
      >
        <div ref={(element) => { refs.blockEditorContent = element; }} className="pm-article-block-dialog__editor" />
        <footer className="article-media-modal__footer article-block-editor-modal__footer">
          <button type="button" onClick={actions.done}>Apply Changes</button>
        </footer>
      </ArticleBlockModal>

      <ArticleBlockModal
        modalRef={(element) => { refs.insertDialog = element; }}
        open={ui.insertOpen}
        title={`Add block to ${ui.fieldName}`}
        closeLabel="Close add block"
        onClose={actions.cancelInsert}
      >
        <select
          ref={(element) => { refs.insertSelect = element; }}
          className="pm-article-block-controls__select"
          aria-label="Block type to insert"
          value={ui.insertType}
          onChange={(event) => { actions.setInsertType(event.currentTarget.value); }}
        >
          {ui.blockTypes.map((blockType) => <option key={blockType} value={blockType}>{blockTypeLabel(blockType)}</option>)}
        </select>
        <div ref={(element) => { refs.insertEditorBody = element; }} className="pm-article-block-dialog__editor" />
        <footer className="article-media-modal__footer article-block-editor-modal__footer">
          <button type="button" className="pm-article-block-dialog__button--primary" onClick={actions.commitInsert}>Add</button>
          <button type="button" onClick={actions.cancelInsert}>Cancel</button>
        </footer>
      </ArticleBlockModal>

      <ArticleBlockModal
        modalRef={(element) => { refs.deleteDialog = element; }}
        open={ui.deleteOpen}
        title={`Are you sure you want to delete this ${blockTypeLabel(ui.blockType)} block?`}
        closeLabel="Close delete block"
        onClose={actions.closeDialogs}
      >
        <footer className="article-media-modal__footer article-block-editor-modal__footer">
          <button type="button" className="pm-article-block-dialog__button--danger" onClick={actions.confirmDelete}>Delete</button>
          <button type="button" onClick={actions.closeDialogs}>Cancel</button>
        </footer>
      </ArticleBlockModal>
    </>
  );
}

function ArticleBlockModal({ modalRef, open, title, closeLabel, onClose, children }) {
  return (
    <div
      ref={modalRef}
      className="article-media-modal article-block-editor-modal"
      hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="article-media-modal__backdrop article-block-editor-modal__backdrop" aria-hidden="true" onPointerDown={onClose} />
      <section className="article-media-modal__panel article-media-modal__panel--settings article-block-editor-modal__panel" onClick={(event) => { event.stopPropagation(); }}>
        <header className="article-media-modal__header article-block-editor-modal__header">
          <h2>{title}</h2>
          <button type="button" className="article-media-modal__close article-block-editor-modal__close" aria-label={closeLabel} onClick={onClose}>x</button>
        </header>
        <div className="article-block-editor-modal__body">{children}</div>
      </section>
    </div>
  );
}


function blockCommentsForNode(node) {
  return Array.isArray(node?.attrs?.blockComments) ? node.attrs.blockComments : [];
}

function updateStreamBlockAttrs(instance, info, attrs) {
  instance.view.dispatch(instance.view.state.tr.setNodeMarkup(info.start, undefined, {
    ...info.node.attrs,
    ...attrs,
  }));
}

function updateBlockCommentThread(instance, descriptor, updater) {
  const info = topLevelBlockInfoByIdOrIndex(instance.view.state.doc, descriptor.blockId, descriptor.blockIndex);
  if (!info) return false;

  const nextComments = updater(blockCommentsForNode(info.node));
  updateStreamBlockAttrs(instance, info, { blockComments: nextComments });
  refreshBlockCommentBorders(document.querySelector("[data-article-shadow]")?.shadowRoot);
  return true;
}

export function collectBlockCommentThreads() {
  const threads = [];

  for (const instance of editorState.streamEditors) {
    if (!ARTICLE_STREAM_FIELDS.has(instance.fieldName)) continue;

    for (let blockIndex = 0; blockIndex < instance.view.state.doc.childCount; blockIndex += 1) {
      const node = instance.view.state.doc.child(blockIndex);
      const blockId = node.attrs?.id || "";
      const descriptor = { fieldName: instance.fieldName, blockId, blockIndex };

      for (const thread of blockCommentsForNode(node)) {
        if (!thread?.pending && !(thread?.comments || []).length) continue;
        threads.push({
          threadId: thread.threadId,
          comments: Array.isArray(thread.comments) ? thread.comments : [],
          pending: Boolean(thread.pending),
          resolved: Boolean(thread.resolved),
          fieldName: descriptor.fieldName,
          blockId: descriptor.blockId,
          blockIndex: descriptor.blockIndex,
          commit(comment) {
            return updateBlockCommentThread(instance, descriptor, (comments) => comments.map((item) => (
              item.threadId === thread.threadId
                ? { ...item, pending: false, resolved: false, comments: [...(Array.isArray(item.comments) ? item.comments : []), comment] }
                : item
            )));
          },
          setResolved(resolved) {
            return updateBlockCommentThread(instance, descriptor, (comments) => comments.map((item) => (
              item.threadId === thread.threadId ? { ...item, resolved: Boolean(resolved) } : item
            )));
          },
          remove() {
            return updateBlockCommentThread(instance, descriptor, (comments) => comments.filter((item) => item.threadId !== thread.threadId));
          },
        });
      }
    }
  }

  return threads;
}

export function refreshBlockCommentBorders(manuscriptRoot = null) {
  if (!manuscriptRoot) return;

  for (const articleBlock of manuscriptRoot.querySelectorAll(ARTICLE_BLOCK_SELECTOR)) {
    const instance = editorState.streamEditors.find((item) => item.fieldName === articleBlock.dataset.streamField);
    const info = instance && streamBlockInfoForArticleBlock(instance, articleBlock);
    const hasComments = blockCommentsForNode(info?.node).some((thread) => !thread.resolved && (thread.pending || (thread.comments || []).length));
    articleBlock.classList.toggle("pm-article-block--commented", Boolean(hasComments));
  }
}

export function cleanupArticleBlockControls() {
  editorState.articleBlockControls?.cleanup();
  editorState.articleBlockControls = null;
}

function streamBlockInfoForArticleBlock(instance, articleBlock) {
  return topLevelBlockInfoByIdOrIndex(
    instance.view.state.doc,
    articleBlock.dataset.streamBlockId,
    Number(articleBlock.dataset.streamBlockIndex),
  );
}

function insertBlockAfter(instance, articleBlock, blockType, { keepControls = false } = {}) {
  const info = streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!info || !blockType) return;

  const newBlock = createStreamBlockNode(instance, blockType);
  const descriptor = {
    fieldName: instance.fieldName,
    blockId: newBlock.attrs?.id || "",
    blockIndex: info.index + 1,
  };

  clearSuppressedHover();
  editorState.suppressedHoverArticleBlock = articleBlock;
  editorState.suppressedHoverTimer = setTimeout(() => {
    if (editorState.suppressedHoverArticleBlock === articleBlock) clearSuppressedHover();
  }, 1200);
  editorState.selectedArticleBlock = descriptor;
  instance.view.dispatch(instance.view.state.tr.insert(info.end, newBlock));
  selectArticleBlock(descriptor, articleBlock.getRootNode());
  if (!keepControls) editorState.articleBlockControls?.hide();
  return descriptor;
}

function moveArticleBlock(instance, articleBlock, direction) {
  const info = streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!info || !moveTopLevelBlock(instance.view, info.index, direction)) return;

  const root = articleBlock.getRootNode();
  const fieldName = articleBlock.dataset.streamField;
  const articleBlocks = articleBlocksForStreamField(root, fieldName);
  const target = articleBlocks[articleBlocks.indexOf(articleBlock) + direction];

  if (target && !articleBlock.contains(target) && !target.contains(articleBlock)) {
    if (direction < 0) target.before(articleBlock);
    else target.after(articleBlock);

    refreshArticleBlockIndexes(root, fieldName);
    editorState.articleBlockControls?.setActive?.(articleBlock);
    selectArticleBlockElement(articleBlock);
  }

  editorState.schedulePreview();
}

function deleteArticleBlock(instance, articleBlock) {
  const info = streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!info) return;

  const action = deleteTopLevelBlock(instance.view, info);
  editorState.selectedArticleBlock = null;

  if (action === "deleted") {
    const root = articleBlock.getRootNode();
    const fieldName = articleBlock.dataset.streamField;
    articleBlock.remove();
    refreshArticleBlockIndexes(root, fieldName);
  }

  showSelectedArticleBlockEditor(null);
  editorState.articleBlockControls?.hide();
}

function articleBlocksForStreamField(root, fieldName) {
  const selector = `${ARTICLE_BLOCK_SELECTOR}[data-stream-field="${window.CSS.escape(fieldName)}"]`;
  return Array.from(root.querySelectorAll(selector)).filter((block) => {
    const parentBlock = block.parentElement?.closest(selector);
    return !parentBlock || !root.contains(parentBlock);
  });
}

function refreshArticleBlockIndexes(root, fieldName) {
  articleBlocksForStreamField(root, fieldName).forEach((block, index) => {
    block.dataset.streamBlockIndex = index;
  });
}

export function describeArticleBlock(articleBlock) {
  const instance = editorState.streamEditors.find((item) => item.fieldName === articleBlock.dataset.streamField);
  const info = instance && streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!instance || !info) return null;

  return {
    fieldName: instance.fieldName,
    blockId: info.node.attrs?.id || articleBlock.dataset.streamBlockId || "",
    blockIndex: info.index,
  };
}

function selectArticleBlockElement(articleBlock) {
  selectArticleBlock(describeArticleBlock(articleBlock), articleBlock.getRootNode());
}

export function selectArticleBlock(descriptor, manuscriptRoot = null, options = {}) {
  if (!descriptor) return false;

  editorState.selectedArticleBlock = descriptor;
  document.querySelectorAll("[data-metadata-tab]").forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.metadataTab === "article"));
  });
  document.querySelectorAll("[data-metadata-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.metadataPanel !== "article";
  });
  showSelectedArticleBlockEditor(descriptor);

  const articleBlock = manuscriptRoot && findArticleBlock(manuscriptRoot, descriptor);
  manuscriptRoot?.querySelectorAll(".pm-article-block--selected").forEach((block) => {
    block.classList.remove("pm-article-block--selected");
  });

  if (articleBlock) {
    articleBlock.classList.add("pm-article-block--selected");
    editorState.articleBlockControls?.setActive?.(articleBlock);
    if (options.reveal) articleBlock.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return true;
}

export function findArticleBlock(root, descriptor) {
  const blocks = articleBlocksForStreamField(root, descriptor.fieldName);
  return (descriptor.blockId && blocks.find((block) => block.dataset.streamBlockId === String(descriptor.blockId))) || blocks[descriptor.blockIndex] || null;
}

// Hides unrelated sidebar blocks (maybe not the best approach but works for now)
export function showSelectedArticleBlockEditor(descriptor) {
  for (const instance of editorState.streamEditors) {
    if (!ARTICLE_STREAM_FIELDS.has(instance.fieldName)) continue;

    const section = instance.mount.closest(".editor-section");
    const isSelectedField = descriptor?.fieldName === instance.fieldName;
    if (section) section.hidden = Boolean(descriptor && !isSelectedField);

    const blocks = Array.from(instance.mount.querySelectorAll(".pm-stream-block"));
    if (!descriptor) {
      blocks.forEach((block) => { block.hidden = false; });
      continue;
    }

    const selectedBlock = (
      (descriptor.blockId && blocks.find((block) => block.dataset.streamBlockId === String(descriptor.blockId))) ||
      blocks[descriptor.blockIndex]
    );

    blocks.forEach((block) => {
      block.hidden = Boolean(isSelectedField && selectedBlock && block !== selectedBlock);
    });
  }
}

function clearSuppressedHover() {
  if (editorState.suppressedHoverTimer) clearTimeout(editorState.suppressedHoverTimer);
  editorState.suppressedHoverTimer = null;
  editorState.suppressedHoverArticleBlock = null;
}

// Arrow key navigation
export function setupArticleBlockKeyboard(manuscriptRoot) {
  document.addEventListener("keydown", (event) => {
    const direction = ARTICLE_KEY_DIRECTIONS[event.key];
    const isEditing = (event.composedPath?.() || []).some((element) => (
      ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(element?.nodeName) ||
      element?.isContentEditable ||
      element?.classList?.contains("ProseMirror")
    ));

    if (!direction || isEditing || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    const descriptors = articleBlockDescriptors();
    if (!descriptors.length) return;

    const currentIndex = editorState.selectedArticleBlock ? descriptors.findIndex((descriptor) => sameArticleBlock(descriptor, editorState.selectedArticleBlock)) : -1;
    const nextIndex = currentIndex < 0 ? (direction > 0 ? 0 : descriptors.length - 1) : Math.max(0, Math.min(descriptors.length - 1, currentIndex + direction));

    if (nextIndex === currentIndex) return;
    clearSuppressedHover();
    if (selectArticleBlock(descriptors[nextIndex], manuscriptRoot, { reveal: true })) event.preventDefault();
  });
}

export function articleBlockDescriptors() {
  const descriptors = [];

  for (const fieldName of ARTICLE_STREAM_FIELDS) {
    const instance = editorState.streamEditors.find((item) => item.fieldName === fieldName);
    if (!instance) continue;

    for (let blockIndex = 0; blockIndex < instance.view.state.doc.childCount; blockIndex += 1) {
      const node = instance.view.state.doc.child(blockIndex);
      descriptors.push({
        fieldName,
        blockId: node.attrs?.id || "",
        blockIndex,
      });
    }
  }
  return descriptors;
}

export function sameArticleBlock(left, right) {
  if (!left || !right || left.fieldName !== right.fieldName) return false;
  return left.blockId || right.blockId ? left.blockId === right.blockId : left.blockIndex === right.blockIndex;
}
