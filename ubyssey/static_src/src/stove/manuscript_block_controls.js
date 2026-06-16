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

export function setupArticleBlockControls(manuscriptRoot) {
  if (!manuscriptRoot) return;

  cleanupArticleBlockControls();
  manuscriptRoot.querySelectorAll(".pm-article-block-controls, .pm-article-block-controls-layer").forEach((element) => { element.remove(); });
  if (!manuscriptRoot.querySelector(ARTICLE_BLOCK_SELECTOR)) return;

  const element = (tag, className) => Object.assign(document.createElement(tag), { className });

  const layer = element("div", "pm-article-block-controls-layer");
  const outline = element("div", "pm-article-block-outline");
  const controls = element("div", "pm-article-block-controls");
  const select = element("select", "pm-article-block-controls__select");
  const buttons = {};

  select.setAttribute("aria-label", "Block type to insert");
  controls.appendChild(select);

  const addButton = (key, label, title, callback, extraClass = "") => {
    buttons[key] = makeButton(label, () => {
      const { instance, articleBlock } = editorState.articleBlockControls || {};
      if (instance && articleBlock) callback(instance, articleBlock, select.value);
    }, title, `pm-article-block-controls__button ${extraClass}`.trim());
    controls.appendChild(buttons[key]);
  };

  [
    ["insert", "+", "Insert after", insertBlockAfter],
    ["up", "↑", "Move up", (instance, articleBlock) => { moveArticleBlock(instance, articleBlock, -1); }],
    ["down", "↓", "Move down", (instance, articleBlock) => { moveArticleBlock(instance, articleBlock, 1); }],
    ["delete", "Del", "Delete", deleteArticleBlock, "pm-article-block-controls__button--danger"],
  ].forEach((args) => { addButton(...args); });

  layer.appendChild(outline);
  layer.appendChild(controls);
  manuscriptRoot.appendChild(layer);

  const state = {
    articleBlock: null,
    instance: null,
    hideTimer: null,

    cleanup() {
      clearTimeout(this.hideTimer);
      for (const [target, eventName, listener, options] of listeners) {
        target.removeEventListener(eventName, listener, options);
      }
      layer.remove();
    },

    hide() {
      clearTimeout(this.hideTimer);
      this.articleBlock = null;
      this.instance = null;
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

  const positionControls = () => {
    if (!state.articleBlock) return;

    const rect = state.articleBlock.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      state.hide();
      return;
    }

    // Set to zero for now since makes it hard to select on non-desktop
    const offset = 0;
    const padding = 6;
    layer.classList.add("is-active");
    Object.assign(outline.style, {
      left: `${rect.left - offset}px`,
      top: `${rect.top - offset}px`,
      width: `${rect.width + (offset * 2)}px`,
      height: `${rect.height + (offset * 2)}px`,
    });

    Object.assign(controls.style, { left: "0px", top: "0px" });
    const controlsRect = controls.getBoundingClientRect();
    const left = Math.max(padding, Math.min(rect.left - offset, window.innerWidth - controlsRect.width - padding));
    const topCandidate = rect.top - offset - controlsRect.height;
    const top = Math.max(padding, Math.min(
      topCandidate < padding ? rect.top + offset : topCandidate,
      window.innerHeight - controlsRect.height - padding,
    ));
    Object.assign(controls.style, { left: `${left}px`, top: `${top}px` });
  };

  const insideActiveArea = (target) => Boolean(target && (
    controls.contains(target) || state.articleBlock?.contains(target)
  ));

  const showFromTarget = (target, shouldSelect = false) => {
    if (controls.contains(target)) {
      clearTimeout(state.hideTimer);
      return;
    }

    const articleBlock = target.closest?.(ARTICLE_BLOCK_SELECTOR);
    if (!articleBlock) return;

    if (!shouldSelect && articleBlock === editorState.suppressedHoverArticleBlock) return;
    if (shouldSelect || articleBlock !== editorState.suppressedHoverArticleBlock) clearSuppressedHover();

    state.setActive(articleBlock);
    if (shouldSelect) selectArticleBlockElement(articleBlock);
  };

  // Delays hiding so pointer can move between block and toolbar (not a good approach lol)
  const scheduleHide = () => {
    clearTimeout(state.hideTimer);
    state.hideTimer = setTimeout(() => {
      if (!insideActiveArea(manuscriptRoot.activeElement)) state.hide();
    }, 120);
  };

  const onOver = (event) => { showFromTarget(event.target); };
  const onFocusIn = (event) => { showFromTarget(event.target, true); };
  const onClick = (event) => { showFromTarget(event.target, true); };
  const onOut = (event) => {
    if (editorState.suppressedHoverArticleBlock?.contains(event.target) && !editorState.suppressedHoverArticleBlock.contains(event.relatedTarget)) {
      clearSuppressedHover();
    }
    if (insideActiveArea(event.target) && !insideActiveArea(event.relatedTarget)) scheduleHide();
  };
  const onFocusOut = () => { setTimeout(scheduleHide, 0); };
  const listeners = [
    [manuscriptRoot, "mouseover", onOver],
    [manuscriptRoot, "focusin", onFocusIn],
    [manuscriptRoot, "click", onClick],
    [manuscriptRoot, "mouseout", onOut],
    [manuscriptRoot, "focusout", onFocusOut],
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

function insertBlockAfter(instance, articleBlock, blockType) {
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
  editorState.articleBlockControls?.hide();
}

function moveArticleBlock(instance, articleBlock, direction) {
  const info = streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!info || !moveTopLevelBlock(instance.view, info.index, direction)) return;

  const root = articleBlock.getRootNode();
  const fieldName = articleBlock.dataset.streamField;
  const articleBlocks = articleBlocksForStreamField(root, fieldName);
  const target = articleBlocks[articleBlocks.indexOf(articleBlock) + direction];
  if (!target) return;

  if (direction < 0) target.before(articleBlock);
  else target.after(articleBlock);

  refreshArticleBlockIndexes(root, fieldName);
  editorState.articleBlockControls?.setActive?.(articleBlock);
  selectArticleBlockElement(articleBlock);
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
    const selectedBlock = (descriptor.blockId && blocks.find((block) => block.dataset.streamBlockId === String(descriptor.blockId)));
    
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
