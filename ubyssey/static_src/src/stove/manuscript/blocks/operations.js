// Block operations, like inserting/moving/deleting, block comments
// controller connects these with components.jsx, and state/DOM events

import { createStreamBlockNode, deleteTopLevelBlock, moveTopLevelBlock, topLevelBlockInfoByIdOrIndex } from "../stream/index.jsx";
import { manuscriptSession } from "../session.js";

const ARTICLE_BLOCK_SELECTOR = "[data-article-block][data-stream-field]";
const ARTICLE_STREAM_FIELDS = new Set(["header", "content"]);
// Potentially remove, idk if people will use these now that the UI is better
const ARTICLE_KEY_DIRECTIONS = {
  ArrowUp: -1,
  ArrowLeft: -1,
  ArrowDown: 1,
  ArrowRight: 1,
};

export function blockCommentsForNode(node) {
  return Array.isArray(node?.attrs?.blockComments) ? node.attrs.blockComments : [];
}

export function updateStreamBlockAttrs(instance, info, attrs) {
  instance.view.dispatch(instance.view.state.tr.setNodeMarkup(info.start, undefined, {
    ...info.node.attrs,
    ...attrs,
  }));
}

export function updateBlockCommentThread(instance, descriptor, updater) {
  const info = topLevelBlockInfoByIdOrIndex(instance.view.state.doc, descriptor.blockId, descriptor.blockIndex);
  if (!info) return false;

  const nextComments = updater(blockCommentsForNode(info.node));
  updateStreamBlockAttrs(instance, info, { blockComments: nextComments });
  refreshBlockCommentBorders(document.querySelector("[data-article-shadow]")?.shadowRoot);
  return true;
}

export function collectBlockCommentThreads() {
  const threads = [];

  for (const instance of manuscriptSession.streamEditors) {
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
    const instance = manuscriptSession.streamEditors.find((item) => item.fieldName === articleBlock.dataset.streamField);
    const info = instance && streamBlockInfoForArticleBlock(instance, articleBlock);
    const hasComments = blockCommentsForNode(info?.node).some((thread) => !thread.resolved && (thread.pending || (thread.comments || []).length));
    articleBlock.classList.toggle("pm-article-block--commented", Boolean(hasComments));
  }
}

export function cleanupArticleBlockControls() {
  manuscriptSession.articleBlockControls?.cleanup();
  manuscriptSession.articleBlockControls = null;
}

export function streamBlockInfoForArticleBlock(instance, articleBlock) {
  return topLevelBlockInfoByIdOrIndex(
    instance.view.state.doc,
    articleBlock.dataset.streamBlockId,
    Number(articleBlock.dataset.streamBlockIndex),
  );
}

export function insertBlockAfter(instance, articleBlock, blockType, { keepControls = false } = {}) {
  const info = streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!info || !blockType) return;

  const newBlock = createStreamBlockNode(instance, blockType);
  const descriptor = {
    fieldName: instance.fieldName,
    blockId: newBlock.attrs?.id || "",
    blockIndex: info.index + 1,
  };

  clearSuppressedHover();
  manuscriptSession.suppressedHoverArticleBlock = articleBlock;
  manuscriptSession.suppressedHoverTimer = setTimeout(() => {
    if (manuscriptSession.suppressedHoverArticleBlock === articleBlock) clearSuppressedHover();
  }, 1200);
  manuscriptSession.selectedArticleBlock = descriptor;
  instance.view.dispatch(instance.view.state.tr.insert(info.end, newBlock));
  selectArticleBlock(descriptor, articleBlock.getRootNode());
  if (!keepControls) manuscriptSession.articleBlockControls?.hide();
  return descriptor;
}

export function moveArticleBlock(instance, articleBlock, direction) {
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
    manuscriptSession.articleBlockControls?.setActive?.(articleBlock);
    selectArticleBlockElement(articleBlock);
  }

  manuscriptSession.schedulePreview();
}

export function deleteArticleBlock(instance, articleBlock) {
  const info = streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!info) return;

  const action = deleteTopLevelBlock(instance.view, info);
  manuscriptSession.richTextToolbar?.setHistoryView(instance.view);
  manuscriptSession.selectedArticleBlock = null;

  if (action === "deleted") {
    const root = articleBlock.getRootNode();
    const fieldName = articleBlock.dataset.streamField;
    articleBlock.remove();
    refreshArticleBlockIndexes(root, fieldName);
  }

  showSelectedArticleBlockEditor(null);
  manuscriptSession.articleBlockControls?.hide();
}

export function articleBlocksForStreamField(root, fieldName) {
  const selector = `${ARTICLE_BLOCK_SELECTOR}[data-stream-field="${window.CSS.escape(fieldName)}"]`;
  return Array.from(root.querySelectorAll(selector)).filter((block) => {
    const parentBlock = block.parentElement?.closest(selector);
    return !parentBlock || !root.contains(parentBlock);
  });
}

export function refreshArticleBlockIndexes(root, fieldName) {
  articleBlocksForStreamField(root, fieldName).forEach((block, index) => {
    block.dataset.streamBlockIndex = index;
  });
}

export function describeArticleBlock(articleBlock) {
  const instance = manuscriptSession.streamEditors.find((item) => item.fieldName === articleBlock.dataset.streamField);
  const info = instance && streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!instance || !info) return null;

  return {
    fieldName: instance.fieldName,
    blockId: info.node.attrs?.id || articleBlock.dataset.streamBlockId || "",
    blockIndex: info.index,
  };
}

export function selectArticleBlockElement(articleBlock) {
  selectArticleBlock(describeArticleBlock(articleBlock), articleBlock.getRootNode());
}

export function selectArticleBlock(descriptor, manuscriptRoot = null, options = {}) {
  if (!descriptor) return false;

  manuscriptSession.selectedArticleBlock = descriptor;
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
    manuscriptSession.articleBlockControls?.setActive?.(articleBlock);
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
  for (const instance of manuscriptSession.streamEditors) {
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

export function clearSuppressedHover() {
  if (manuscriptSession.suppressedHoverTimer) clearTimeout(manuscriptSession.suppressedHoverTimer);
  manuscriptSession.suppressedHoverTimer = null;
  manuscriptSession.suppressedHoverArticleBlock = null;
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

    const currentIndex = manuscriptSession.selectedArticleBlock ? descriptors.findIndex((descriptor) => sameArticleBlock(descriptor, manuscriptSession.selectedArticleBlock)) : -1;
    const nextIndex = currentIndex < 0 ? (direction > 0 ? 0 : descriptors.length - 1) : Math.max(0, Math.min(descriptors.length - 1, currentIndex + direction));

    if (nextIndex === currentIndex) return;
    clearSuppressedHover();
    if (selectArticleBlock(descriptors[nextIndex], manuscriptRoot, { reveal: true })) event.preventDefault();
  });
}

export function articleBlockDescriptors() {
  const descriptors = [];

  for (const fieldName of ARTICLE_STREAM_FIELDS) {
    const instance = manuscriptSession.streamEditors.find((item) => item.fieldName === fieldName);
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
