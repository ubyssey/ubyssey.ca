import { articleBlocksForStreamField } from "../blocks/controller.jsx";
import { manuscriptSession } from "../session.js";
import { ARTICLE_BLOCK_SELECTOR, LAST_PREVIEW_HTML } from "./constants.js";
import { destroyEditorViewsWithin, setupArticlePreviewEditors } from "./editors.jsx";
import { samePath } from "./sources.js";

// Converts Prosemirror Document into block descriptors
function streamBlocks(doc) {
  const blocks = [];
  doc.forEach((node, _offset, index) => {
    blocks.push({
      blockId: node.attrs?.id,
      blockIndex: index,
      blockType: node.attrs?.blockType,
      id: String(node.attrs?.id || ""),
      index,
      node,
    });
  });
  return blocks;
}

// Compares doc structure before and after, detects added/deleted/moved
function diffStreamBlockStructure(beforeDoc, afterDoc) {
  const before = streamBlocks(beforeDoc);
  const after = streamBlocks(afterDoc);
  const beforeIds = before.map((block) => block.id);
  const afterIds = after.map((block) => block.id);
  const hasUniqueIds = (ids) => ids.every(Boolean) && new Set(ids).size === ids.length;
  const invalidIdentity = !hasUniqueIds(beforeIds) || !hasUniqueIds(afterIds);
  const structureChanged = (
    before.length !== after.length
    || before.some((block, index) => (
      block.id !== after[index]?.id || block.blockType !== after[index]?.blockType
    ))
  );

  if (!structureChanged) {
    return {
      after,
      before,
      deleted: [],
      inserted: [],
      invalidIdentity,
      moved: [],
      structureChanged,
      typeChanged: [],
    };
  }

  const beforeIdSet = new Set(beforeIds.filter(Boolean));
  const afterIdSet = new Set(afterIds.filter(Boolean));
  const beforeById = new Map(before.map((block) => [block.id, block]));
  const afterById = new Map(after.map((block) => [block.id, block]));
  const deleted = before.filter((block) => block.id && !afterIdSet.has(block.id));
  const inserted = after.filter((block) => block.id && !beforeIdSet.has(block.id));
  const typeChanged = invalidIdentity ? [] : after.filter((block) => (
    beforeById.has(block.id)
    && beforeById.get(block.id).blockType !== block.blockType
  ));
  const retainedBeforeIds = beforeIds.filter((id) => afterById.has(id));
  const retainedAfterIds = afterIds.filter((id) => beforeById.has(id));
  const moved = invalidIdentity ? [] : retainedAfterIds
    .filter((id, index) => retainedBeforeIds[index] !== id)
    .map((id) => afterById.get(id));

  return {
    after,
    before,
    deleted,
    inserted,
    invalidIdentity,
    moved,
    structureChanged,
    typeChanged,
  };
}

function isManuscriptRichTextBlock(block) {
  if (block.blockType !== "richtext") return false;

  let manuscriptField = false;
  block.node.forEach((child) => {
    if (
      child.type.name === "editable_field"
      && child.attrs?.mode === "richtext"
      && child.attrs?.manuscriptOwned
      && samePath(child.attrs?.path, [])
    ) manuscriptField = true;
  });
  return manuscriptField;
}

// Clones existing RichText Block, and removes editor specific classes/attributes and assigns a new ID/index
function createRichTextPreviewBlock(template, previousBlock, nextBlock, descriptor) {
  const newBlock = template.cloneNode(false);
  newBlock.classList.remove("ProseMirror", "pm-manuscript-rich-text");
  newBlock.removeAttribute("contenteditable");
  newBlock.removeAttribute("role");
  newBlock.dataset.streamBlockId = descriptor.blockId;
  newBlock.dataset.streamBlockIndex = String(descriptor.blockIndex);
  if (previousBlock) previousBlock.after(newBlock);
  else nextBlock.before(newBlock);
  return newBlock;
}

// Updates DOM and editor descriptors after structural changes
function refreshPreviewBlockIndexes(root, fieldName) {
  const blocks = articleBlocksForStreamField(root, fieldName);
  blocks.forEach((block, index) => {
    block.dataset.streamBlockIndex = String(index);
  });
  [
    ...manuscriptSession.articleRichTextEditors,
    ...manuscriptSession.articleDirectTextEditors,
  ]
    .filter((editor) => editor.streamSource?.instance.fieldName === fieldName)
    .forEach((editor) => {
      const index = blocks.findIndex((block) => (
        block.dataset.streamBlockId === String(editor.streamSource.blockId)
      ));
      if (index < 0) return;

      editor.blockIndex = index;
      editor.streamSource.blockIndex = index;
    });
  LAST_PREVIEW_HTML.delete(root.querySelector("[data-article-preview-content]"));
}

// Reconciles doc structure changes, 
// deleted blocks have DOM removed and editor destroyed
// RichText Blocks do their special behaviours with enter/backspace
// Moved blocks are reordered
// etc
export function reconcilePreviewBlocks({ before, doc, instance }) {
  const changes = diffStreamBlockStructure(before, doc);
  if (!changes.structureChanged) {
    return {
      changes: null,
      previewReconciled: false,
      structureChanged: false,
    };
  }

  const insertedRichText = changes.inserted.filter(isManuscriptRichTextBlock);
  let previewReconciled = (
    !changes.invalidIdentity
    && !changes.typeChanged.length
    && insertedRichText.length === changes.inserted.length
  );

  const root = document.querySelector("[data-article-shadow]")?.shadowRoot;
  const articleBlocks = root ? articleBlocksForStreamField(root, instance.fieldName) : [];
  const articleBlocksById = new Map(articleBlocks.map((block) => [
    String(block.dataset.streamBlockId || ""),
    block,
  ]));

  const retainedIds = new Set(changes.after.map((block) => block.id).filter(Boolean));
  const retainedArticleBlocks = articleBlocks.filter((block) => (
    retainedIds.has(String(block.dataset.streamBlockId || ""))
  ));

  const activeBlock = root?.activeElement?.closest?.(ARTICLE_BLOCK_SELECTOR);
  const positionAnchor = changes.moved.length ? null : retainedArticleBlocks.includes(activeBlock)
    ? activeBlock
    : retainedArticleBlocks.find((block) => {
      const bounds = block.getBoundingClientRect();
      return bounds.bottom >= 0 && bounds.top <= window.innerHeight;
    }) || retainedArticleBlocks[0];

  const positionTop = positionAnchor?.getBoundingClientRect().top;
  const editors = manuscriptSession.articleRichTextEditors.filter((editor) => editor.streamSource?.instance === instance);
  const richTextTemplate = editors[0]?.view.dom.closest(ARTICLE_BLOCK_SELECTOR)?.cloneNode(false);
  if (!root) previewReconciled = false;

  changes.deleted.forEach((block) => {
    const articleBlock = articleBlocksById.get(block.id);
    if (!articleBlock) {
      previewReconciled = false;
      return;
    }

    destroyEditorViewsWithin(manuscriptSession.articleDirectTextEditors, articleBlock);
    destroyEditorViewsWithin(manuscriptSession.articleRichTextEditors, articleBlock);
    manuscriptSession.articleDirectPlainTextEditors = manuscriptSession.articleDirectPlainTextEditors
      .filter(({ element }) => element !== articleBlock && !articleBlock.contains(element));
    articleBlock.remove();
  });

  insertedRichText.forEach((block) => {
    if (!root || !richTextTemplate) {
      previewReconciled = false;
      return;
    }
    const currentBlocksById = new Map(
      articleBlocksForStreamField(root, instance.fieldName).map((articleBlock) => [
        String(articleBlock.dataset.streamBlockId || ""),
        articleBlock,
      ]),
    );
    const previous = changes.after[block.index - 1];
    const next = changes.after[block.index + 1];
    const previousArticleBlock = previous && currentBlocksById.get(previous.id);
    const nextArticleBlock = next && currentBlocksById.get(next.id);
    if (!previousArticleBlock && !nextArticleBlock) {
      previewReconciled = false;
      return;
    }

    const articleBlock = createRichTextPreviewBlock(
      richTextTemplate,
      previousArticleBlock,
      nextArticleBlock,
      block,
    );
    setupArticlePreviewEditors(root, new Map([[instance.fieldName, doc.toJSON()]]), articleBlock);
  });

  if (root && changes.moved.length) {
    const currentBlocks = articleBlocksForStreamField(root, instance.fieldName);
    const currentBlocksById = new Map(currentBlocks.map((block) => [
      String(block.dataset.streamBlockId || ""),
      block,
    ]));
    const orderedBlocks = changes.after.map((block) => currentBlocksById.get(block.id));
    const parent = orderedBlocks[0]?.parentNode;
    if (
      orderedBlocks.some((block) => !block)
      || !parent
      || orderedBlocks.some((block) => block.parentNode !== parent)
    ) {
      previewReconciled = false;
    } else {
      const marker = root.ownerDocument.createComment("stream-block-order");
      currentBlocks[0].before(marker);
      orderedBlocks.forEach((block) => marker.before(block));
      marker.remove();

      const movedIds = new Set(changes.moved.map((block) => block.id));
      const streamDocs = new Map([[instance.fieldName, doc.toJSON()]]);
      orderedBlocks
        .filter((block) => movedIds.has(String(block.dataset.streamBlockId || "")))
        .forEach((block) => {
          destroyEditorViewsWithin(manuscriptSession.articleDirectTextEditors, block);
          destroyEditorViewsWithin(manuscriptSession.articleRichTextEditors, block);
          manuscriptSession.articleDirectPlainTextEditors = manuscriptSession.articleDirectPlainTextEditors
            .filter(({ element }) => element !== block && !block.contains(element));
          setupArticlePreviewEditors(root, streamDocs, block);
        });
    }
  }

  if (root) refreshPreviewBlockIndexes(root, instance.fieldName);
  if (positionAnchor && positionTop !== undefined) {
    window.requestAnimationFrame(() => {
      if (!positionAnchor.isConnected) return;
      const offset = positionAnchor.getBoundingClientRect().top - positionTop;
      if (Math.abs(offset) > 0.5) window.scrollBy(0, offset);
    });
  }
  return {
    changes,
    previewReconciled,
    structureChanged: true,
  };
}
