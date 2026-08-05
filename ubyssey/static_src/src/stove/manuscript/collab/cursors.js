// We can't use YJS cursor plugin, because we show cursor on preview editors, not stream

import * as Y from "yjs";
import { relativePositionToAbsolutePosition, ySyncPluginKey } from "y-prosemirror";
import { manuscriptSession } from "../session.js";
import { currentEditableField } from "../preview/sources.js";

const PREVIEW_SELECTOR = ".article-shadow-preview";
const PLAIN_TEXT_SELECTOR = ".pm-manuscript-direct-plain-text";
const RICH_TEXT_SELECTOR = ".ProseMirror";

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function editorContext(root, user, block, selector) {
  const element = [block, ...block.querySelectorAll(selector)].filter((element) => element.matches(selector))[user.selection.editorIndex];
  const container = root.querySelector(PREVIEW_SELECTOR);
  return element && container ? { element, container } : null;
}

function containerPosition(rect, container) {
  if (!container) return { left: rect.left, top: rect.top };
  const containerRect = container.getBoundingClientRect();
  return {
    left: rect.left - containerRect.left + container.scrollLeft,
    top: rect.top - containerRect.top + container.scrollTop,
  };
}

function renderCursorMarker(user, rect, container = null) {
  const cursor = document.createElement("span");
  const position = containerPosition(rect, container);
  cursor.className = container ? "pm-remote-cursor" : "pm-remote-cursor pm-remote-cursor--document";
  cursor.style.backgroundColor = user.colour;
  cursor.style.left = `${position.left}px`;
  cursor.style.top = `${position.top}px`;
  cursor.style.height = `${Math.max(rect.height || rect.bottom - rect.top, 16)}px`;

  const label = document.createElement("span");
  label.className = "pm-remote-cursor__label";
  label.style.backgroundColor = user.colour;
  label.textContent = user.name;
  cursor.appendChild(label);
  (container || document.body).appendChild(cursor);
}

function renderSelectionHighlights(user, rectangles, container) {
  rectangles.forEach((rectangle) => {
    const position = containerPosition(rectangle, container);
    const highlight = document.createElement("span");
    highlight.className = "pm-remote-selection";
    highlight.style.backgroundColor = user.colour;
    highlight.style.left = `${position.left}px`;
    highlight.style.top = `${position.top}px`;
    highlight.style.width = `${Math.max(rectangle.width, 2)}px`;
    highlight.style.height = `${Math.max(rectangle.height, 16)}px`;
    container.appendChild(highlight);
  });
}

function rectsFromRange(start, end) {
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  const rectangles = Array.from(range.getClientRects());
  return rectangles.length ? rectangles : [range.getBoundingClientRect()];
}

function textPointAtOffset(element, offset) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset);
  let lastText = null;

  while (walker.nextNode()) {
    lastText = walker.currentNode;
    if (remaining <= lastText.nodeValue.length) return { node: lastText, offset: remaining };
    remaining -= lastText.nodeValue.length;
  }

  return lastText
    ? { node: lastText, offset: lastText.nodeValue.length }
    : { node: element, offset: 0 };
}

function plainTextGeometry(element, selection) {
  const cursorPoint = textPointAtOffset(element, selection.cursor);
  const cursorRect = rectsFromRange(cursorPoint, cursorPoint)[0] || element.getBoundingClientRect();
  const selectionRects = selection.from === selection.to ? [] : rectsFromRange(
    textPointAtOffset(element, Math.min(selection.from, selection.to)),
    textPointAtOffset(element, Math.max(selection.from, selection.to)),
  );
  return { cursorRect, selectionRects };
}

function richTextGeometry(view, selection) {
  const documentSize = view.state.doc.content.size;
  const cursorPosition = clamp(selection.cursor, 0, documentSize);
  const coordinates = view.coordsAtPos(cursorPosition);
  const from = clamp(selection.from, 0, documentSize);
  const to = clamp(selection.to, from, documentSize);

  return {
    cursorRect: {
      left: coordinates.left,
      top: coordinates.top,
      height: coordinates.bottom - coordinates.top,
    },
    selectionRects: from === to ? [] : rectsFromRange(view.domAtPos(from), view.domAtPos(to)),
  };
}

export function renderPlainTextCursor(root, user, block) {
  if (!Number.isInteger(user.selection.cursor)) return false;

  const context = editorContext(root, user, block, PLAIN_TEXT_SELECTOR);
  if (!context) return false;

  const geometry = plainTextGeometry(context.element, user.selection);
  renderSelectionHighlights(user, geometry.selectionRects, context.container);
  renderCursorMarker(user, geometry.cursorRect, context.container);
  return true;
}

export function renderRichTextCursor(root, user, block) {
  if (!Number.isInteger(user.selection.cursor)) return false;

  const context = editorContext(root, user, block, RICH_TEXT_SELECTOR);
  if (!context) return null;

  const view = [
    ...manuscriptSession.articleRichTextEditors,
    ...manuscriptSession.articleDirectTextEditors,
  ].find((editor) => editor.view.dom === context.element)?.view;

  const richContext = view ? { view, container: context.container } : null;
  if (!richContext) return false;

  const geometry = richTextGeometry(richContext.view, user.selection);
  renderSelectionHighlights(user, geometry.selectionRects, richContext.container);
  renderCursorMarker(user, geometry.cursorRect, richContext.container);
  return true;
}

export function clearDocumentCursors() {
  document.querySelectorAll(".pm-remote-cursor--document").forEach((cursor) => { cursor.remove(); });
}
