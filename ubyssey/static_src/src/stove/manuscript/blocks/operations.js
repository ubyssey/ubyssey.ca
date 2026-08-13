// Block operations, like inserting/moving/deleting, block comments
// controller connects these with components.jsx, and state/DOM events

import { deleteTopLevelBlock, moveTopLevelBlock, topLevelBlockInfoByIdOrIndex } from "../stream/index.jsx";
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

export function updateStreamBlockAttrs(instance, info, attrs, { skipPreview = false } = {}) {
  instance.updateDoc((transaction) => transaction.setNodeMarkup(info.start, undefined, {
    ...info.node.attrs,
    ...attrs, 
  }), { checkStructure: false, skipPreview });
}

export function updateBlockCommentThread(instance, descriptor, updater) {
  const info = topLevelBlockInfoByIdOrIndex(instance.doc, descriptor.blockId, descriptor.blockIndex);
  if (!info) return false;

  const nextComments = updater(blockCommentsForNode(info.node));
  updateStreamBlockAttrs(instance, info, { blockComments: nextComments }, { skipPreview: true });
  refreshBlockCommentBorders(document.querySelector("[data-article-shadow]")?.shadowRoot);
  return true;
}

export function collectBlockCommentThreads() {
  const threads = [];

  for (const instance of manuscriptSession.streamEditors) {
    if (!ARTICLE_STREAM_FIELDS.has(instance.fieldName)) continue;

    const doc = instance.doc;
    for (let blockIndex = 0; blockIndex < doc.childCount; blockIndex += 1) {
      const node = doc.child(blockIndex);
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

  // Builds block lookup for each StreamField to avoid walking each time
  const blocksByField = new Map();
  for (const instance of manuscriptSession.streamEditors) {
    if (!ARTICLE_STREAM_FIELDS.has(instance.fieldName)) continue;
    const blocks = [];
    const blocksById = new Map();
    instance.doc.forEach((node) => {
      blocks.push(node);
      if (node.attrs?.id) blocksById.set(String(node.attrs.id), node);
    });
    blocksByField.set(instance.fieldName, { blocks, blocksById });
  }

  for (const articleBlock of manuscriptRoot.querySelectorAll(ARTICLE_BLOCK_SELECTOR)) {
    const fieldBlocks = blocksByField.get(articleBlock.dataset.streamField);
    const blockId = articleBlock.dataset.streamBlockId;
    const node = blockId ? fieldBlocks?.blocksById.get(blockId) : fieldBlocks?.blocks[Number(articleBlock.dataset.streamBlockIndex)];
    const hasComments = blockCommentsForNode(node).some((thread) => !thread.resolved && (thread.pending || (thread.comments || []).length));
    articleBlock.classList.toggle("pm-article-block--commented", Boolean(hasComments));
  }
}


export function streamBlockInfoForArticleBlock(instance, articleBlock) {
  return topLevelBlockInfoByIdOrIndex(
    instance.doc,
    articleBlock.dataset.streamBlockId,
    Number(articleBlock.dataset.streamBlockIndex),
  );
}

export function moveArticleBlock(instance, articleBlock, direction) {
  const info = streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!info) return;
  instance.updateDoc((transaction) => moveTopLevelBlock(transaction, info.index, direction));
}

export function deleteArticleBlock(instance, articleBlock) {
  const info = streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!info) return;

  instance.updateDoc((transaction) => deleteTopLevelBlock(transaction, info));
  manuscriptSession.selectedArticleBlock = null;
  syncSelectedArticleBlockEditor(null);
}

export function articleBlocksForStreamField(root, fieldName) {
  const selector = `${ARTICLE_BLOCK_SELECTOR}[data-stream-field="${window.CSS.escape(fieldName)}"]`;
  return Array.from(root.querySelectorAll(selector)).filter((block) => {
    const parentBlock = block.parentElement?.closest(selector);
    return !parentBlock || !root.contains(parentBlock);
  });
}

export function describeArticleBlock(articleBlock) {
  const instance = manuscriptSession.streamEditors.find((item) => item.fieldName === articleBlock.dataset.streamField);
  if (!instance) return null;

  return {
    fieldName: instance.fieldName,
    blockId: articleBlock.dataset.streamBlockId || "",
    blockIndex: articleBlock.dataset.streamBlockIndex,
  };
}

export function selectArticleBlockElement(articleBlock) {
  selectArticleBlock(describeArticleBlock(articleBlock), articleBlock.getRootNode());
}

export function selectArticleBlock(descriptor, manuscriptRoot = null, options = {}) {
  if (!descriptor) return false;

  const articleBlock = manuscriptRoot && findArticleBlock(manuscriptRoot, descriptor);

  manuscriptSession.selectedArticleBlock = descriptor;
  document.querySelectorAll("[data-metadata-tab]").forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.metadataTab === "article"));
  });
  document.querySelectorAll("[data-metadata-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.metadataPanel !== "article";
  });
  syncSelectedArticleBlockEditor(descriptor);

  manuscriptRoot?.querySelectorAll(".pm-article-block--selected").forEach((block) => {
    block.classList.remove("pm-article-block--selected");
  });

  if (articleBlock) {
    articleBlock.classList.add("pm-article-block--selected");
    if (options.reveal) articleBlock.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  manuscriptSession.richTextToolbar?.update();
  return true;
}

export function findArticleBlock(root, descriptor) {
  const blocks = articleBlocksForStreamField(root, descriptor.fieldName);
  if (descriptor.blockId) {
    return blocks.find((block) => block.dataset.streamBlockId === String(descriptor.blockId)) || null;
  }
  return blocks[descriptor.blockIndex] || null;
}

export function syncSelectedArticleBlockEditor(descriptor) {
  manuscriptSession.users?.sendBlockSelection(descriptor);
  showSelectedArticleBlockEditor(descriptor);
}

// Hides unrelated sidebar blocks (maybe not the best approach but works for now)
function showSelectedArticleBlockEditor(descriptor) {
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

    const selectedBlock = descriptor.blockId ? blocks.find((block) => block.dataset.streamBlockId === String(descriptor.blockId)) : blocks[descriptor.blockIndex];

    blocks.forEach((block) => {
      block.hidden = Boolean(isSelectedField && selectedBlock && block !== selectedBlock);
    });
  }
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
    if (selectArticleBlock(descriptors[nextIndex], manuscriptRoot, { reveal: true })) event.preventDefault();
  });
}

export function articleBlockDescriptors() {
  const descriptors = [];

  for (const fieldName of ARTICLE_STREAM_FIELDS) {
    const instance = manuscriptSession.streamEditors.find((item) => item.fieldName === fieldName);
    if (!instance) continue;

    const doc = instance.doc;
    for (let blockIndex = 0; blockIndex < doc.childCount; blockIndex += 1) {
      const node = doc.child(blockIndex);
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
