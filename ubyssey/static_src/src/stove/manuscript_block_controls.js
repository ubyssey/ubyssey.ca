// Handles floating block controls in article preview

import { makeButton } from "./prosemirror_base";
import { createStreamBlockNode } from "./stream_editor";
import { deleteTopLevelBlock, moveTopLevelBlock, topLevelBlockInfoByIdOrIndex } from "./stream_schema";
import { editorState } from "./manuscript_editor";
import { selectMetadataTab } from "./sidebar";

const ARTICLE_BLOCK_SELECTOR = "[data-article-block][data-stream-field]";
const ARTICLE_STREAM_FIELDS = new Set(["header", "content"]);
const ARTICLE_KEY_DIRECTIONS = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};

const CONTROL_EVENTS = ["click", "mousedown", "pointerdown", "mouseup", "change", "input"];
const FOCUSABLE = "input, textarea, select, button";

const element = (tag, className, textContent = "") => Object.assign(document.createElement(tag), { className, textContent });
const targetInside = (target, elements) => Boolean(target && elements.some((item) => item.contains(target)));
const eventInside = (event, elements) => {
  const path = event.composedPath?.() || [];
  return elements.some((item) => path.includes(item));
};

function focusFirst(root, preferred = null) {
  window.requestAnimationFrame(() => {
    (preferred || root.querySelector(FOCUSABLE))?.focus();
  });
}

function stopEvents(elements) {
  for (const target of elements) {
    for (const eventName of CONTROL_EVENTS) {
      target.addEventListener(eventName, (event) => { event.stopPropagation(); });
    }
  }
}

function createBlockEditorModal() {
  const modal = element("div", "article-block-editor-modal");
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "article-block-editor-title");
  modal.innerHTML = `
    <button type="button" class="article-block-editor-modal__backdrop" data-article-block-editor-close aria-label="Close block editor"></button>
    <section class="article-block-editor-modal__panel">
      <header class="article-block-editor-modal__header">
        <h2 id="article-block-editor-title">Edit block</h2>
        <button type="button" class="article-block-editor-modal__close" data-article-block-editor-close aria-label="Close block editor">x</button>
      </header>
      <div class="article-block-editor-modal__body" data-article-block-editor-body></div>
      <footer class="article-block-editor-modal__footer">
        <button type="button" data-article-block-editor-close>Done</button>
      </footer>
    </section>
  `;
  return {
    modal,
    body: modal.querySelector("[data-article-block-editor-body]"),
    title: modal.querySelector("#article-block-editor-title"),
  };
}


export function setupArticleBlockControls(manuscriptRoot) {
  if (!manuscriptRoot) return;

  cleanupArticleBlockControls();
  manuscriptRoot.querySelectorAll(".pm-article-block-controls, .pm-article-block-controls-layer").forEach((element) => { element.remove(); });
  if (!manuscriptRoot.querySelector(ARTICLE_BLOCK_SELECTOR)) return;

  const controlsHost = manuscriptRoot.querySelector(".article-shadow-preview");
  if (!controlsHost) return;

  const layer = element("div", "pm-article-block-controls-layer");
  const topControls = element("div", "pm-article-block-controls pm-article-block-controls--top");
  const insertDialog = element("div", "pm-article-block-dialog pm-article-block-dialog--insert");
  const deleteDialog = element("div", "pm-article-block-dialog pm-article-block-dialog--delete");
  const dialogs = [insertDialog, deleteDialog];
  const controls = [topControls, ...dialogs];
  const select = element("select", "pm-article-block-controls__select");
  const buttons = {};

  select.setAttribute("aria-label", "Block type to insert");

  const { modal: blockEditorModal, body: blockEditorBody, title: blockEditorTitle } = createBlockEditorModal();
  const manuscriptForm = document.querySelector("[data-manuscript-form]");
  (manuscriptForm || document.body).appendChild(blockEditorModal);
  let blockEditorHome = null;
  let pendingAdd = null;

  const withActiveBlock = (callback) => {
    const { instance, articleBlock } = editorState.articleBlockControls || {};
    if (instance && articleBlock) callback(instance, articleBlock);
  };

  const isDialogOpen = () => dialogs.some((dialog) => dialog.classList.contains("is-open"));
  const closeDialogs = () => { dialogs.forEach((dialog) => { dialog.classList.remove("is-open"); }); };

  const cancelInsertDialog = () => {
    removePendingAdd();
    closeDialogs();
    closeBlockEditorModal();
  };

  const commitInsertDialog = () => {
    if (!pendingAdd) addSelectedBlockForEditing();
    if (!pendingAdd) return;

    pendingAdd = null;
    closeDialogs();
    closeBlockEditorModal({ keepSelection: true });
  };

  const editorSectionForDescriptor = (descriptor) => {
    const instance = editorState.streamEditors.find((item) => item.fieldName === descriptor?.fieldName);
    const section = instance?.mount.closest(".editor-section");
    return section ? { instance, section } : null;
  };

  const blockNameForDescriptor = (descriptor) => {
    const instance = editorState.streamEditors.find((item) => item.fieldName === descriptor?.fieldName);
    const block = instance && topLevelBlockInfoByIdOrIndex(instance.view.state.doc, descriptor?.blockId, descriptor?.blockIndex)?.node;
    const label = String(block?.attrs?.blockType || "block").replace(/[_-]+/g, " ").trim() || "block";
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const restoreBlockEditorHome = () => {
    const restoredInstance = blockEditorHome?.instance;
    if (blockEditorHome?.section && blockEditorHome.parent) {
      blockEditorHome.parent.insertBefore(blockEditorHome.section, blockEditorHome.nextSibling);
    }
    blockEditorHome = null;
    restoredInstance?.view?.updateRoot?.();
  };

  const closeBlockEditorModal = ({ keepSelection = false, refreshPreview = true } = {}) => {
    restoreBlockEditorHome();
    blockEditorModal.hidden = true;
    editorState.blockEditorModalOpen = false;
    if (!keepSelection) {
      editorState.selectedArticleBlock = null;
      showSelectedArticleBlockEditor(null);
    }
    if (refreshPreview) editorState.schedulePreview();
  };

  const moveBlockEditorTo = (descriptor, target) => {
    const editorSection = editorSectionForDescriptor(descriptor);
    if (!editorSection) return false;

    if (blockEditorHome?.section !== editorSection.section) restoreBlockEditorHome();
    if (!blockEditorHome) {
      blockEditorHome = {
        instance: editorSection.instance,
        section: editorSection.section,
        parent: editorSection.section.parentNode,
        nextSibling: editorSection.section.nextSibling,
      };
    }

    editorState.selectedArticleBlock = descriptor;
    editorState.blockEditorModalOpen = true;
    showSelectedArticleBlockEditor(descriptor);
    target.appendChild(editorSection.section);
    editorSection.instance.view.updateRoot?.();
    return true;
  };

  const openBlockEditorModal = (descriptor) => {
    if (!moveBlockEditorTo(descriptor, blockEditorBody)) return;
    blockEditorTitle.textContent = `Edit ${blockNameForDescriptor(descriptor)}`;
    blockEditorModal.hidden = false;
    focusFirst(blockEditorBody);
  };

  blockEditorModal.querySelectorAll("[data-article-block-editor-close]").forEach((button) => {
    button.addEventListener("click", closeBlockEditorModal);
  });
  blockEditorModal.querySelector(".article-block-editor-modal__panel")?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  const openDialog = (dialog, focusTarget = null) => {
    if (insertDialog.classList.contains("is-open")) cancelInsertDialog();
    else closeDialogs();
    dialog.classList.add("is-open");
    positionControls();
    focusFirst(dialog, focusTarget);
  };

  const addButton = (key, label, title, callback, extraClass = "") => {
    buttons[key] = makeButton(label, () => {
      withActiveBlock(callback);
    }, title, `pm-article-block-controls__button ${extraClass}`.trim());
    return buttons[key];
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

  const addSelectedBlockForEditing = () => {
    const active = editorState.articleBlockControls || {};
    const root = active.articleBlock?.getRootNode?.();
    const anchorBlock = (
      pendingAdd?.anchor && root && findArticleBlock(root, pendingAdd.anchor)
    ) || active.articleBlock;
    const instance = pendingAdd?.instance || active.instance;
    if (!instance || !anchorBlock) return;

    editorState.blockEditorModalOpen = true;
    restoreBlockEditorHome();
    blockEditorModal.hidden = true;
    removePendingAdd();

    const anchor = describeArticleBlock(anchorBlock);
    const descriptor = insertBlockAfter(instance, anchorBlock, select.value, { keepControls: true });
    if (descriptor && moveBlockEditorTo(descriptor, insertEditorBody)) {
      pendingAdd = { instance, descriptor, anchor };
      insertDialog.classList.add("is-open");
      positionControls();
    }
  };

  buttons.insert = makeButton("+", () => {
    openDialog(insertDialog, select);
  }, "Add block", "pm-article-block-controls__button pm-article-block-controls__button--insert");
  buttons.edit = makeButton("Edit", () => {
    withActiveBlock((instance, articleBlock) => {
      const descriptor = describeArticleBlock(articleBlock);
      if (descriptor) openBlockEditorModal(descriptor);
    });
  }, "Edit block", "pm-article-block-controls__button pm-article-block-controls__button--edit");

  topControls.append(
    addButton("delete", "X", "Delete", () => { openDialog(deleteDialog); }, "pm-article-block-controls__button--danger"),
    addButton("up", "", "Move up", (instance, articleBlock) => { moveArticleBlock(instance, articleBlock, -1); }, "pm-article-block-controls__button--move pm-article-block-controls__button--up"),
    addButton("down", "", "Move down", (instance, articleBlock) => { moveArticleBlock(instance, articleBlock, 1); }, "pm-article-block-controls__button--move pm-article-block-controls__button--down"),
    buttons.edit,
    buttons.insert,
  );

  const insertTitle = element("div", "pm-article-block-dialog__title", "Add block");
  const insertEditorBody = element("div", "pm-article-block-dialog__editor");
  const insertActions = element("div", "pm-article-block-dialog__actions");
  insertActions.appendChild(makeButton("Add", commitInsertDialog, "Add selected block", "pm-article-block-dialog__button pm-article-block-dialog__button--primary"));
  insertActions.appendChild(makeButton("Cancel", cancelInsertDialog, "Cancel", "pm-article-block-dialog__button"));
  insertDialog.append(insertTitle, select, insertEditorBody, insertActions);

  const deleteTitle = element("div", "pm-article-block-dialog__title", "Noooooooo");
  const deleteActions = element("div", "pm-article-block-dialog__actions");
  deleteActions.appendChild(makeButton("Delete", () => {
    withActiveBlock((instance, articleBlock) => {
      deleteArticleBlock(instance, articleBlock);
      closeDialogs();
    });
  }, "Delete block", "pm-article-block-dialog__button pm-article-block-dialog__button--danger"));
  deleteActions.appendChild(makeButton("Cancel", closeDialogs, "Cancel", "pm-article-block-dialog__button"));
  deleteDialog.append(deleteTitle, deleteActions);

  stopEvents(controls);

  layer.append(...controls);
  controlsHost.appendChild(layer);

  const state = {
    articleBlock: null,
    instance: null,
    hideTimer: null,

    cleanup() {
      clearTimeout(this.hideTimer);
      for (const [target, eventName, listener, options] of listeners) {
        target.removeEventListener(eventName, listener, options);
      }
      removePendingAdd();
      closeBlockEditorModal({ refreshPreview: false });
      blockEditorModal.remove();
      layer.remove();
    },

    hide() {
      clearTimeout(this.hideTimer);
      this.articleBlock = null;
      this.instance = null;
      closeDialogs();
      layer.classList.remove("is-active");
    },

    setActive(articleBlock) {
      const instance = editorState.streamEditors.find((item) => item.fieldName === articleBlock.dataset.streamField);
      const info = instance && streamBlockInfoForArticleBlock(instance, articleBlock);
      if (!instance || !info) {
        this.hide();
        return;
      }

      clearTimeout(this.hideTimer);
      this.articleBlock = articleBlock;
      this.instance = instance;
      fillSelect(instance);
      buttons.up.disabled = info.index === 0;
      buttons.down.disabled = info.index === instance.view.state.doc.childCount - 1;
      positionControls();
    },
  };

  select.addEventListener("change", () => {
    if (state.instance) editorState.preferredInsertTypes.set(state.instance.fieldName, select.value);
    if (insertDialog.classList.contains("is-open")) addSelectedBlockForEditing();
  });

  const fillSelect = (instance) => {
    const blockTypes = instance.availableBlockTypes || [];
    const preferredValue = editorState.preferredInsertTypes.get(instance.fieldName);
    const currentValue = select.value;

    select.replaceChildren(...blockTypes.map((blockType) => {
      const option = document.createElement("option");
      option.value = blockType;
      option.textContent = blockType;
      return option;
    }));

    const nextValue = [preferredValue, currentValue, blockTypes[0]].find((value) => value && blockTypes.includes(value));
    if (nextValue) {
      select.value = nextValue;
      editorState.preferredInsertTypes.set(instance.fieldName, nextValue);
    }
  };

  const positionAbsoluteElement = (target, left, top, width = target.offsetWidth, height = target.offsetHeight, padding = 6) => {
    const maxLeft = Math.max(padding, controlsHost.clientWidth - width - padding);
    const maxTop = Math.max(padding, controlsHost.clientHeight - height - padding);
    const nextLeft = Math.max(padding, Math.min(left, maxLeft));
    const nextTop = Math.max(padding, Math.min(top, maxTop));
    Object.assign(target.style, { left: `${nextLeft}px`, top: `${nextTop}px` });
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
    Object.assign(topControls.style, { left: "0px", top: "0px" });
    positionAbsoluteElement(
      topControls,
      blockLeft + rect.width + 8,
      blockTop,
      topControls.offsetWidth,
      topControls.offsetHeight,
      padding,
    );

    for (const dialog of dialogs) {
      if (!dialog.classList.contains("is-open")) continue;
      Object.assign(dialog.style, { left: "0px", top: "0px" });
      positionAbsoluteElement(
        dialog,
        blockLeft + (rect.width / 2) - (dialog.offsetWidth / 2),
        blockTop + (rect.height / 2) - (dialog.offsetHeight / 2),
        dialog.offsetWidth,
        dialog.offsetHeight,
        padding,
      );
    }
  }

  const insideActiveArea = (target) => targetInside(target, controls) || Boolean(state.articleBlock?.contains(target));
  // Allows clicks inside direct edit area to not hide the controls
  const eventInsideDirectEdit = (event) => (event.composedPath?.() || [])
    .some((target) => target.matches?.(".pm-manuscript-direct-edit, .pm-manuscript-direct-edit *"));
  const articleBlockFromEvent = (event) => {
    const fromPath = (event.composedPath?.() || [event.target])
      .map((target) => target.closest?.(ARTICLE_BLOCK_SELECTOR))
      .find(Boolean);
    const fromPoint = Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
      ? controlsHost.getRootNode().elementFromPoint?.(event.clientX, event.clientY)?.closest?.(ARTICLE_BLOCK_SELECTOR)
      : null;
    return fromPath || fromPoint;
  };

  const showFromEvent = (event, shouldSelect = false) => {
    if (eventInside(event, controls)) {
      clearTimeout(state.hideTimer);
      return;
    }

    if (isDialogOpen()) {
      if (!shouldSelect) return;
      if (insertDialog.classList.contains("is-open")) cancelInsertDialog();
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
    if (isDialogOpen()) return;
    clearTimeout(state.hideTimer);
    state.hideTimer = setTimeout(() => {
      if (!insideActiveArea(manuscriptRoot.activeElement)) state.hide();
    }, 120);
  };

  const onOver = (event) => {
    if (!isDialogOpen()) showFromEvent(event);
  };
  const onFocusIn = (event) => {
    if (eventInsideDirectEdit(event)) return;
    if (isDialogOpen() && eventInside(event, dialogs)) return;
    showFromEvent(event, true);
  };
  const onClick = (event) => {
    if (eventInside(event, controls) || eventInsideDirectEdit(event)) return;
    if (insertDialog.classList.contains("is-open")) cancelInsertDialog();
    else if (isDialogOpen()) closeDialogs();
    showFromEvent(event, true);
  };
  const onOut = (event) => {
    if (isDialogOpen()) return;
    if (editorState.suppressedHoverArticleBlock?.contains(event.target) && !editorState.suppressedHoverArticleBlock.contains(event.relatedTarget)) {
      clearSuppressedHover();
    }
    if (insideActiveArea(event.target) && !insideActiveArea(event.relatedTarget)) scheduleHide();
  };
  const onFocusOut = () => {
    if (!isDialogOpen()) setTimeout(scheduleHide, 0);
  };
  const onKeyDown = (event) => {
    if (event.key !== "Escape") return;
    if (insertDialog.classList.contains("is-open")) cancelInsertDialog();
    else closeDialogs();
  };
  const listeners = [
    [manuscriptRoot, "mouseover", onOver],
    [manuscriptRoot, "pointermove", onOver],
    [manuscriptRoot, "focusin", onFocusIn],
    [manuscriptRoot, "click", onClick],
    [manuscriptRoot, "mouseout", onOut],
    [manuscriptRoot, "focusout", onFocusOut],
    [manuscriptRoot, "keydown", onKeyDown],
    [window, "scroll", positionControls, true],
    [window, "resize", positionControls],
  ];

  for (const [target, eventName, listener, options] of listeners) {
    target.addEventListener(eventName, listener, options);
  }

  editorState.articleBlockControls = state;
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

  if (target) {
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
  return Array.from(root.querySelectorAll(`${ARTICLE_BLOCK_SELECTOR}[data-stream-field="${window.CSS.escape(fieldName)}"]`));
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
  selectMetadataTab("article");
  showSelectedArticleBlockEditor(descriptor);

  const articleBlock = manuscriptRoot && findArticleBlock(manuscriptRoot, descriptor);
  if (articleBlock) {
    editorState.articleBlockControls?.setActive?.(articleBlock);
    if (options.reveal) articleBlock.scrollIntoView({ block: "nearest" });
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
    const selectedBlock = descriptor && (
      (descriptor.blockId && blocks.find((block) => block.dataset.streamBlockId === String(descriptor.blockId))) ||
      blocks[descriptor.blockIndex]
    );

    blocks.forEach((block) => {
      block.hidden = Boolean(descriptor && block !== selectedBlock);
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
