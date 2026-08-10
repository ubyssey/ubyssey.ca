// Preview block HTML replacement and restores block controls

import { articleBlockDescriptors, describeArticleBlock, findArticleBlock, sameArticleBlock, syncSelectedArticleBlockEditor } from "../blocks/controller.jsx";
import { manuscriptSession } from "../session.js";
import { ARTICLE_BLOCK_SELECTOR, LAST_PREVIEW_HTML } from "./constants.js";
import { destroyEditorViews, destroyEditorViewsWithin, setupArticlePreviewEditors } from "./editors.jsx";

export function replaceSelectedBlockPreviewHtml(manuscriptRoot, html, streamDocs, selected) {
  if (!selected) return false;

  const currentBlock = findArticleBlock(manuscriptRoot, selected);
  if (!currentBlock) return false;

  const template = document.createElement("template");
  template.innerHTML = html;
  const replacement = findArticleBlock(template.content, selected);
  if (!replacement) return false;

  const previousTop = currentBlock.getBoundingClientRect().top;
  destroyEditorViewsWithin(manuscriptSession.articleDirectTextEditors, currentBlock);
  destroyEditorViewsWithin(manuscriptSession.articleRichTextEditors, currentBlock);
  manuscriptSession.articleDirectPlainTextEditors = manuscriptSession.articleDirectPlainTextEditors
    .filter(({ element }) => element !== currentBlock && !currentBlock.contains(element));
  currentBlock.replaceWith(replacement);
  LAST_PREVIEW_HTML.delete(manuscriptRoot.querySelector("[data-article-preview-content]"));
  setupArticlePreviewEditors(manuscriptRoot, streamDocs, replacement);

  replacement.classList.add("pm-article-block--selected");
  manuscriptSession.users?.renderLocations();
  window.requestAnimationFrame(() => {
    const offset = replacement.getBoundingClientRect().top - previousTop;
    if (Math.abs(offset) > 0.5) window.scrollBy(0, offset);
  });
  return true;
}

// Refreshes non-focused blocks in preview so you don't lose your place while editing a block
export function replaceUnfocusedArticleBlocks(manuscriptRoot, html, streamDocs) {
  const content = manuscriptRoot.querySelector("[data-article-preview-content]");
  if (!content) return false;

  const focusedBlock = focusedArticleBlock(manuscriptRoot);
  if (!focusedBlock) return false;

  const template = document.createElement("template");
  template.innerHTML = html;
  const anchor = previewPositionAnchor(manuscriptRoot);
  const currentBlocks = Array.from(content.querySelectorAll(ARTICLE_BLOCK_SELECTOR))
    .filter((block) => {
      const parentBlock = block.parentElement?.closest(ARTICLE_BLOCK_SELECTOR);
      return !parentBlock || !content.contains(parentBlock);
    });

  for (const currentBlock of currentBlocks) {
    if (currentBlock === focusedBlock || currentBlock.contains(focusedBlock)) continue;

    const descriptor = describeArticleBlock(currentBlock);
    const replacement = descriptor && findArticleBlock(template.content, descriptor);
    destroyEditorViewsWithin(manuscriptSession.articleDirectTextEditors, currentBlock);
    destroyEditorViewsWithin(manuscriptSession.articleRichTextEditors, currentBlock);
    manuscriptSession.articleDirectPlainTextEditors = manuscriptSession.articleDirectPlainTextEditors
      .filter(({ element }) => element !== currentBlock && !currentBlock.contains(element));

    if (!replacement) {
      currentBlock.remove();
      continue;
    }

    currentBlock.replaceWith(replacement);
    setupArticlePreviewEditors(manuscriptRoot, streamDocs, replacement);
    if (
      manuscriptSession.selectedArticleBlock
      && sameArticleBlock(descriptor, manuscriptSession.selectedArticleBlock)
    ) {
      replacement.classList.add("pm-article-block--selected");
    }
  }

  manuscriptSession.users?.renderLocations();
  manuscriptSession.commentSidebar?.update();
  manuscriptSession.footnoteSidebar?.update();
  LAST_PREVIEW_HTML.delete(content);
  if (anchor) window.requestAnimationFrame(() => restorePreviewPosition(manuscriptRoot, anchor));
  return true;
}

// Finds currently focused block
export function focusedArticleBlock(manuscriptRoot) {
  const activeBlock = manuscriptRoot.activeElement?.closest?.(ARTICLE_BLOCK_SELECTOR);
  if (activeBlock) return activeBlock;

  const modalActive = document.activeElement?.closest?.(".article-block-editor-modal");
  if (!modalActive || !manuscriptSession.selectedArticleBlock) return null;
  return findArticleBlock(manuscriptRoot, manuscriptSession.selectedArticleBlock);
}

function previewPositionAnchor(manuscriptRoot) {
  const content = manuscriptRoot.querySelector("[data-article-preview-content]");
  if (!content) return null;

  const selected = manuscriptSession.selectedArticleBlock
    && findArticleBlock(manuscriptRoot, manuscriptSession.selectedArticleBlock);
  const visible = Array.from(content.querySelectorAll(ARTICLE_BLOCK_SELECTOR)).find((block) => {
    const bounds = block.getBoundingClientRect();
    return bounds.bottom >= 0 && bounds.top <= window.innerHeight;
  });
  const element = selected || visible || content;
  const descriptor = element === content ? null : describeArticleBlock(element);
  return { descriptor, top: element.getBoundingClientRect().top };
}

// Restores scroll position after preview replacement, using previewPositionAnchor
function restorePreviewPosition(manuscriptRoot, anchor) {
  if (!anchor) return;
  const content = manuscriptRoot.querySelector("[data-article-preview-content]");
  const element = (anchor.descriptor && findArticleBlock(manuscriptRoot, anchor.descriptor)) || content;
  if (!element) return;

  const offset = element.getBoundingClientRect().top - anchor.top;
  if (Math.abs(offset) > 0.5) window.scrollBy(0, offset);
}

// Full preview replacement, for initial load, or restore
export function replaceArticlePreviewHtml(manuscriptRoot, html, {
  preservePosition = false,
  skipIfUnchanged = false,
  } = {})
{
  const content = manuscriptRoot.querySelector("[data-article-preview-content]");
  if (!content) return false;
  if (skipIfUnchanged && LAST_PREVIEW_HTML.get(content) === html) return false;

  const anchor = preservePosition ? previewPositionAnchor(manuscriptRoot) : null;
  destroyEditorViews(manuscriptSession.articleDirectTextEditors);
  destroyEditorViews(manuscriptSession.articleRichTextEditors);
  manuscriptSession.articleDirectPlainTextEditors = [];
  content.innerHTML = html;
  LAST_PREVIEW_HTML.set(content, html);
  if (anchor) window.requestAnimationFrame(() => restorePreviewPosition(manuscriptRoot, anchor));
  return true;
}

export function restoreCurrentArticleControls(manuscriptRoot, streamDocs) {
  setupArticlePreviewEditors(manuscriptRoot, streamDocs);

  const articleBlock = manuscriptSession.selectedArticleBlock && findArticleBlock(manuscriptRoot, manuscriptSession.selectedArticleBlock);
  if (articleBlock) {
    manuscriptSession.selectedArticleBlock = describeArticleBlock(articleBlock) || manuscriptSession.selectedArticleBlock;
  } else if (
    manuscriptSession.selectedArticleBlock &&
    !articleBlockDescriptors().some((item) => sameArticleBlock(item, manuscriptSession.selectedArticleBlock))
  ) {
    manuscriptSession.selectedArticleBlock = null;
  }

  syncSelectedArticleBlockEditor(manuscriptSession.selectedArticleBlock);
  if (articleBlock) {
    articleBlock.classList.add("pm-article-block--selected");
  }
  manuscriptSession.users?.renderLocations();
  manuscriptSession.commentSidebar?.update();
  manuscriptSession.footnoteSidebar?.update();
}
