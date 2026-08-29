// To use page JS and CSS in the preview without affecting the actual editor, we use Shadow DOM
// see https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM

// Most of this deals with handling updates to the Shadow DOM preview while maintaining scroll position and whatnot

const theme = "light" // todo Add setting in future

import { pageEditorState } from "../state.js";
import { destroyEditorViewsWithin, destroyPagePreviewEditors, setupPagePreviewEditors } from "./editables.jsx";
import { samePath } from "../prosemirror/fields.js";
import { sameBlock } from "../prosemirror/blocks.js";
import { diffStreamBlockStructure } from "../prosemirror/document.js";
import {
  pageBlocksForStreamField,
  pageBlockDescriptors,
  describePageBlock,
  findPageBlock,
  syncSelectedPageBlockEditor,
  PAGE_BLOCK_SELECTOR,
} from "./selection.js";

const CONTENT_SELECTOR = "[data-page-preview-content]";
const SELECTED_CLASS = "pm-page-block--selected";
const lastPreviewHtml = new WeakMap();

function replacePreviewBlock(pageRoot, currentBlock, replacement, streamDocs) {
  destroyPageEditorsWithin(currentBlock);
  currentBlock.replaceWith(replacement);
  lastPreviewHtml.delete(pageRoot.querySelector(CONTENT_SELECTOR));
  setupPagePreviewEditors(pageRoot, streamDocs, replacement);
  return replacement;
}

export function replaceSelectedBlockPreviewHtml(pageRoot, html, streamDocs, selected) {
  if (!selected) return false;

  const currentBlock = findPageBlock(pageRoot, selected);
  if (!currentBlock) return false;

  const template = document.createElement("template");
  template.innerHTML = html;
  const replacement = findPageBlock(template.content, selected);
  if (!replacement) return false;

  const previousTop = currentBlock.getBoundingClientRect().top;
  replacePreviewBlock(pageRoot, currentBlock, replacement, streamDocs);

  replacement.classList.add(SELECTED_CLASS);
  pageEditorState.users.renderBlockSelection();
  window.requestAnimationFrame(() => {
    const offset = replacement.getBoundingClientRect().top - previousTop;
    if (Math.abs(offset) > 0.5) window.scrollBy(0, offset);
  });
  return true;
}

// Refreshes non-focused blocks in preview so you don't lose your place while editing a block
export function replaceUnfocusedPageBlocks(pageRoot, html, streamDocs) {
  const content = pageRoot.querySelector(CONTENT_SELECTOR);
  if (!content) return false;

  const activeBlock = focusedPageBlock(pageRoot);
  if (!activeBlock) return false;

  const template = document.createElement("template");
  template.innerHTML = html;
  const anchor = previewPositionAnchor(pageRoot);
  const currentBlocks = Array.from(content.querySelectorAll(PAGE_BLOCK_SELECTOR))
    .filter((block) => {
      const parentBlock = block.parentElement?.closest(PAGE_BLOCK_SELECTOR);
      return !parentBlock || !content.contains(parentBlock);
    });

  for (const currentBlock of currentBlocks) {
    if (currentBlock === activeBlock || currentBlock.contains(activeBlock)) continue;

    const descriptor = describePageBlock(currentBlock);
    const replacement = descriptor && findPageBlock(template.content, descriptor);

    if (!replacement) {
      destroyPageEditorsWithin(currentBlock);
      currentBlock.remove();
      continue;
    }

    replacePreviewBlock(pageRoot, currentBlock, replacement, streamDocs);
    if (pageEditorState.selectedBlock && sameBlock(descriptor, pageEditorState.selectedBlock)) {
      replacement.classList.add(SELECTED_CLASS);
    }
  }

  pageEditorState.users.renderBlockSelection();
  pageEditorState.commentSidebar.update();
  pageEditorState.footnoteSidebar.update();
  lastPreviewHtml.delete(content);
  if (anchor) window.requestAnimationFrame(() => restorePreviewPosition(pageRoot, anchor));
  return true;
}

export function focusedPageBlock(pageRoot) {
  const activeBlock = pageRoot.activeElement?.closest?.(PAGE_BLOCK_SELECTOR);
  if (activeBlock) return activeBlock;

  if (!document.activeElement?.closest?.(".page-block-editor-modal") || !pageEditorState.selectedBlock) return null;
  return findPageBlock(pageRoot, pageEditorState.selectedBlock);
}

function previewPositionAnchor(pageRoot) {
  const content = pageRoot.querySelector(CONTENT_SELECTOR);
  if (!content) return null;

  const selected = pageEditorState.selectedBlock && findPageBlock(pageRoot, pageEditorState.selectedBlock);
  const visible = Array.from(content.querySelectorAll(PAGE_BLOCK_SELECTOR)).find((block) => {
    const bounds = block.getBoundingClientRect();
    return bounds.bottom >= 0 && bounds.top <= window.innerHeight;
  });

  const element = selected || visible || content;
  const descriptor = element === content ? null : describePageBlock(element);
  return { descriptor, top: element.getBoundingClientRect().top };
}

function restorePreviewPosition(pageRoot, anchor) {
  if (!anchor) return;
  const content = pageRoot.querySelector(CONTENT_SELECTOR);
  const element = (anchor.descriptor && findPageBlock(pageRoot, anchor.descriptor)) || content;
  if (!element) return;

  const offset = element.getBoundingClientRect().top - anchor.top;
  if (Math.abs(offset) > 0.5) window.scrollBy(0, offset);
}

export function replacePagePreviewHtml(pageRoot, html, {preservePosition = false, skipIfUnchanged = false} = {}) {
  const content = pageRoot.querySelector(CONTENT_SELECTOR);
  if (!content) return false;
  if (skipIfUnchanged && lastPreviewHtml.get(content) === html) return false;

  const anchor = preservePosition ? previewPositionAnchor(pageRoot) : null;
  destroyPagePreviewEditors();

  content.innerHTML = html;
  lastPreviewHtml.set(content, html);
  if (anchor) window.requestAnimationFrame(() => restorePreviewPosition(pageRoot, anchor));
  return true;
}

export function restoreCurrentPageControls(pageRoot, streamDocs) {
  setupPagePreviewEditors(pageRoot, streamDocs);

  const pageBlock = pageEditorState.selectedBlock && findPageBlock(pageRoot, pageEditorState.selectedBlock);
  if (pageBlock) {
    pageEditorState.selectedBlock = describePageBlock(pageBlock) || pageEditorState.selectedBlock;
  } else if (
    pageEditorState.selectedBlock
    && !pageBlockDescriptors().some((item) => sameBlock(item, pageEditorState.selectedBlock))
  ) {
    pageEditorState.selectedBlock = null;
  }

  syncSelectedPageBlockEditor(pageEditorState.selectedBlock);
  if (pageBlock) pageBlock.classList.add(SELECTED_CLASS);
  pageEditorState.users.renderBlockSelection();
  pageEditorState.commentSidebar.update();
  pageEditorState.footnoteSidebar.update();
}

function invalidatePreviewHtml(root) {
  lastPreviewHtml.delete(root.querySelector(CONTENT_SELECTOR));
}

function destroyPageEditorsWithin(block) {
  destroyEditorViewsWithin(pageEditorState.pageDirectRichTextEditors, block);
  destroyEditorViewsWithin(pageEditorState.pageRichTextEditors, block);
  pageEditorState.pageDirectPlainTextEditors = pageEditorState.pageDirectPlainTextEditors
    .filter(({ element }) => element !== block && !block.contains(element));
}

// Shadow DOM
export function setupPageShadow() {
  const host = document.querySelector("[data-page-shadow]");
  if (!host) {
    return null;
  }

  const pageStylesheets = Array.from(host.querySelectorAll("[data-page-stylesheet]"));
  const pageStylesheetHrefs = pageStylesheets.map((stylesheet) => stylesheet.getAttribute("href")).filter(Boolean);

  for (const stylesheet of pageStylesheets) {
    stylesheet.remove();
  }

  const pageHtml = host.innerHTML;
  host.innerHTML = "";

  const shadowRoot = host.shadowRoot || host.attachShadow({ mode: "open" });
  // CreateRange soemtimes doesn't exist in shadow dom root 
  shadowRoot.createRange ||= () => document.createRange();
  shadowRoot.innerHTML = "";

  const stylesheets = [
    host.dataset.typekitCss,
    host.dataset.bootstrapCss,
    ...pageStylesheetHrefs,
    host.dataset.shadowEditorCss,
  ].filter(Boolean);

  for (const href of stylesheets) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    shadowRoot.appendChild(link);
  }

  const shadowHtml = document.createElement("html");
  const shadowBody = document.createElement("body");

  const updateShadowTheme = () => {
    shadowHtml.setAttribute("color-css-theme", document.documentElement.getAttribute("color-css-theme") || theme);
  };

  updateShadowTheme();
  new MutationObserver(updateShadowTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["color-css-theme"],
  });

  shadowHtml.appendChild(shadowBody);
  shadowRoot.appendChild(shadowHtml);

  for (const style of document.querySelectorAll("style")) {
    if (style.textContent?.includes("ProseMirror")) {
      shadowRoot.appendChild(style.cloneNode(true));
    }
  }

  const toolbar = document.createElement("div");
  toolbar.className = "pm-page-toolbar";
  shadowBody.appendChild(toolbar);

  const wrapper = document.createElement("main");
  const content = document.createElement("div");
  wrapper.className = "page-shadow-preview" + (host.dataset.pagePreviewClass ? " " + host.dataset.pagePreviewClass : "");
  content.dataset.pagePreviewContent = "";
  content.innerHTML = pageHtml;
  wrapper.appendChild(content);
  shadowBody.appendChild(wrapper);

  return shadowRoot;
}

function isRootRichTextBlock(block) {
  if (block.blockType !== "richtext") return false;

  let rootField = false;
  block.node.forEach((child) => {
    if (
      child.type.name === "editable_field"
      && child.attrs?.mode === "richtext"
      && child.attrs?.streamRoot
      && samePath(child.attrs?.path, [])
    ) rootField = true;
  });
  return rootField;
}

// Clones existing RichText Block, and removes editor specific classes/attributes and assigns a new ID/index
function createRichTextPreviewBlock(template, previousBlock, nextBlock, descriptor) {
  const newBlock = template.cloneNode(false);
  newBlock.classList.remove("ProseMirror", "pm-page-rich-text");
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
  const blocks = pageBlocksForStreamField(root, fieldName);
  blocks.forEach((block, index) => {
    block.dataset.streamBlockIndex = String(index);
  });
  [
    ...pageEditorState.pageRichTextEditors,
    ...pageEditorState.pageDirectRichTextEditors,
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
  invalidatePreviewHtml(root);
}

// Reconciles doc structure changes, 
// deleted blocks have DOM removed and editor destroyed
// RichText Blocks do their special behaviours with enter/backspace
// Moved blocks are reordered
// etc
export function reconcilePreviewBlocks({ before, doc, instance, pageRoot }) {
  const changes = diffStreamBlockStructure(before, doc);
  if (!changes.structureChanged) {
    return {
      changes: null,
      previewReconciled: false,
      structureChanged: false,
    };
  }

  const insertedRichText = changes.inserted.filter(isRootRichTextBlock);
  let previewReconciled = (
    !changes.invalidIdentity
    && !changes.typeChanged.length
    && insertedRichText.length === changes.inserted.length
  );

  const root = pageRoot;
  const pageBlocks = root ? pageBlocksForStreamField(root, instance.fieldName) : [];
  const pageBlocksById = new Map(pageBlocks.map((block) => [
    String(block.dataset.streamBlockId || ""),
    block,
  ]));

  const retainedIds = new Set(changes.after.map((block) => block.id).filter(Boolean));
  const retainedPageBlocks = pageBlocks.filter((block) => (
    retainedIds.has(String(block.dataset.streamBlockId || ""))
  ));

  const activeBlock = root?.activeElement?.closest?.(PAGE_BLOCK_SELECTOR);
  const positionAnchor = changes.moved.length ? null : retainedPageBlocks.includes(activeBlock) ? activeBlock : retainedPageBlocks.find((block) => {
    const bounds = block.getBoundingClientRect();
    return bounds.bottom >= 0 && bounds.top <= window.innerHeight;
  }) || retainedPageBlocks[0];

  const positionTop = positionAnchor?.getBoundingClientRect().top;
  const editors = pageEditorState.pageRichTextEditors.filter((editor) => editor.streamSource?.instance === instance);
  const richTextTemplate = editors[0]?.view.dom.closest(PAGE_BLOCK_SELECTOR)?.cloneNode(false);
  if (!root) previewReconciled = false;

  changes.deleted.forEach((block) => {
    const pageBlock = pageBlocksById.get(block.id);
    if (!pageBlock) {
      previewReconciled = false;
      return;
    }

    destroyPageEditorsWithin(pageBlock);
    pageBlock.remove();
  });

  insertedRichText.forEach((block) => {
    if (!root || !richTextTemplate) {
      previewReconciled = false;
      return;
    }

    const currentBlocksById = new Map(
      pageBlocksForStreamField(root, instance.fieldName).map((pageBlock) => [
        String(pageBlock.dataset.streamBlockId || ""),
        pageBlock,
      ]),
    );

    const previous = changes.after[block.index - 1];
    const next = changes.after[block.index + 1];
    const previousPageBlock = previous && currentBlocksById.get(previous.id);
    const nextPageBlock = next && currentBlocksById.get(next.id);

    if (!previousPageBlock && !nextPageBlock) {
      previewReconciled = false;
      return;
    }

    const pageBlock = createRichTextPreviewBlock(
      richTextTemplate,
      previousPageBlock,
      nextPageBlock,
      block,
    );
    setupPagePreviewEditors(root, new Map([[instance.fieldName, doc.toJSON()]]), pageBlock);
  });

  if (root && changes.moved.length) {
    const currentBlocks = pageBlocksForStreamField(root, instance.fieldName);
    const currentBlocksById = new Map(currentBlocks.map((block) => [
      String(block.dataset.streamBlockId || ""),
      block,
    ]));

    const orderedBlocks = changes.after.map((block) => currentBlocksById.get(block.id));
    const parent = orderedBlocks[0]?.parentNode;

    if (orderedBlocks.some((block) => !block) || !parent || orderedBlocks.some((block) => block.parentNode !== parent)) {
      previewReconciled = false;
    } else {
      const marker = root.ownerDocument.createComment("stream-block-order");
      currentBlocks[0].before(marker);
      let anchor = marker;
      orderedBlocks.forEach((block) => {
        anchor.after(block);
        anchor = block;
      });
      marker.remove();

      const movedIds = new Set(changes.moved.map((block) => block.id));
      const movedBlocks = orderedBlocks.filter((block) => movedIds.has(String(block.dataset.streamBlockId || "")));
      movedBlocks.forEach((block) => {
        destroyPageEditorsWithin(block);
      });

      const streamDocs = new Map([[instance.fieldName, doc.toJSON()]]);
      movedBlocks.forEach((block) => setupPagePreviewEditors(root, streamDocs, block));
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
