// Selection and Keyboard operations on preview blocks

import { blockDescriptors, sameBlock, topLevelBlockInfoByIdOrIndex } from "../prosemirror/blocks.js";
import { deleteBlock, moveBlock } from "../prosemirror/document.js";
import { pageEditorState } from "../state.js";

export const PAGE_BLOCK_SELECTOR = "[data-article-block][data-stream-field]";

// Potentially remove, idk if people will use these now that the UI is better
// TODO: Double check min-height on blocks works, then remove
const BLOCK_KEY_DIRECTIONS = {
  ArrowUp: -1,
  ArrowLeft: -1,
  ArrowDown: 1,
  ArrowRight: 1,
};

export function movePageBlock(instance, pageBlock, direction) {
  const moved = moveBlock(instance, describePageBlock(pageBlock), direction);
  return moved;
}

export function deletePageBlock(instance, pageBlock) {
  if (!deleteBlock(instance, describePageBlock(pageBlock))) return;
  pageEditorState.selectedBlock = null;
  syncSelectedPageBlockEditor(null);
}

export function pageBlocksForStreamField(root, fieldName) {
  return blocksForStreamField(root, fieldName, PAGE_BLOCK_SELECTOR);
}

export function describePageBlock(pageBlock) {
  const instance = pageEditorState.streamEditors.find((item) => item.fieldName === pageBlock.dataset.streamField);
  if (!instance) return null;

  return {
    fieldName: instance.fieldName,
    blockId: pageBlock.dataset.streamBlockId || "",
    blockIndex: pageBlock.dataset.streamBlockIndex,
  };
}

export function selectPageBlockElement(pageBlock) {
  selectPageBlock(describePageBlock(pageBlock), pageBlock.getRootNode());
}

export function selectPageBlock(descriptor, pageRoot = null, options = {}) {
  if (!descriptor) return false;

  const pageBlock = pageRoot && findPageBlock(pageRoot, descriptor);

  pageEditorState.selectedBlock = descriptor;
  syncSelectedPageBlockEditor(descriptor);

  pageRoot?.querySelectorAll(".pm-page-block--selected").forEach((block) => {
    block.classList.remove("pm-page-block--selected");
  });

  if (pageBlock) {
    pageBlock.classList.add("pm-page-block--selected");
    if (options.reveal) pageBlock.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  pageEditorState.richTextToolbar?.update();
  return true;
}

export function findPageBlock(root, descriptor) {
  return findBlock(root, descriptor, PAGE_BLOCK_SELECTOR);
}

export function syncSelectedPageBlockEditor(descriptor) {
  pageEditorState.users.sendBlockSelection(descriptor);
  pageEditorState.richTextToolbar?.update();
}

export function blockInfoForElement(instance, blockElement) {
  return topLevelBlockInfoByIdOrIndex(
    instance.doc,
    blockElement.dataset.streamBlockId,
    Number(blockElement.dataset.streamBlockIndex),
  );
}

export function blocksForStreamField(root, fieldName, blockSelector) {
  const selector = `${blockSelector}[data-stream-field="${window.CSS.escape(fieldName)}"]`;
  return Array.from(root.querySelectorAll(selector)).filter((block) => {
    const parentBlock = block.parentElement?.closest(selector);
    return !parentBlock || !root.contains(parentBlock);
  });
}

function findBlock(root, descriptor, blockSelector) {
  const blocks = blocksForStreamField(root, descriptor.fieldName, blockSelector);
  if (descriptor.blockId) {
    return blocks.find((block) => block.dataset.streamBlockId === String(descriptor.blockId)) || null;
  }
  return blocks[descriptor.blockIndex] || null;
}

// Arrow key navigation
export function setupPageBlockKeyboard(pageRoot) {
  const handleKeyDown = (event) => {
    const direction = BLOCK_KEY_DIRECTIONS[event.key];
    const isEditing = (event.composedPath?.() || []).some((element) => (
      ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(element?.nodeName) ||
      element?.isContentEditable ||
      element?.classList?.contains("ProseMirror")
    ));

    if (!direction || isEditing || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    const descriptors = pageBlockDescriptors();
    if (!descriptors.length) return;

    const currentIndex = pageEditorState.selectedBlock ? descriptors.findIndex((descriptor) => sameBlock(descriptor, pageEditorState.selectedBlock)) : -1;
    const nextIndex = currentIndex < 0 ? (direction > 0 ? 0 : descriptors.length - 1) : Math.max(0, Math.min(descriptors.length - 1, currentIndex + direction));

    if (nextIndex === currentIndex) return;
    if (selectPageBlock(descriptors[nextIndex], pageRoot, { reveal: true })) event.preventDefault();
  };

  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}

export function pageBlockDescriptors() {
  return blockDescriptors(pageEditorState.streamEditors, new Set(pageEditorState.streamEditors.map((editor) => editor.fieldName)));
}
