// Preview editor setup, and direct edit sync

import { DOMParser as ProseMirrorDOMParser, DOMSerializer, Fragment } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { absolutePositionToRelativePosition, ySyncPluginKey } from "y-prosemirror";
import { ACTIVE_SUGGESTION_THREAD_META, editorPlugins, richTextSchema } from "../rich_text/index.jsx";
import { manuscriptSession } from "../session.js";
import { describeArticleBlock, refreshBlockCommentBorders, selectArticleBlockElement } from "../blocks/controller.jsx";
import { ARTICLE_BLOCK_SELECTOR, DIRECT_EDITABLE_SELECTOR, EMPTY_RICH_TEXT, STREAM_EDITOR_META } from "./constants.js";
import { projectInlineTransaction, writeStreamFieldContent } from "./projection.js";
import { currentEditableField, directEditableSource, samePath } from "./sources.js";

// We marked the actual article HTML with content-editable for prosemirror
function createArticleRichTextEditor(mount, content, className, onDocChanged, streamSource = null) {
  const inlineRichText = mount.dataset.articleEditableMode === "richtext-inline";
  const attributes = { class: className };
  for (const attr of [
    "data-article-block",
    "data-stream-field",
    "data-stream-block-id",
    "data-stream-block-index",
    "data-article-editable-page-field",
    "data-article-editable-featured-media-field",
    "data-article-editable-stream-field",
    "data-article-editable-path",
    "data-article-editable-path-prefix",
    "data-article-editable-mode",
  ]) {
    if (mount.hasAttribute?.(attr)) attributes[attr] = mount.getAttribute(attr);
  }

  let view;
  view = new EditorView({ mount }, {
    state: EditorState.create({
      doc: richTextSchema.nodeFromJSON({ type: "doc", content: content?.length ? content : EMPTY_RICH_TEXT }),
      plugins: editorPlugins(richTextSchema),
    }),

    dispatchTransaction(transaction) {
      const activeSuggestionThreadId = transaction.getMeta(ACTIVE_SUGGESTION_THREAD_META);
      view.updateState(view.state.apply(transaction));
      if (view.hasFocus()) sendCursor();
      manuscriptSession.richTextToolbar?.update();
      if (activeSuggestionThreadId) manuscriptSession.commentSidebar?.activateThread(activeSuggestionThreadId);
      else manuscriptSession.commentSidebar?.update();
      manuscriptSession.footnoteSidebar?.update();
      if (transaction.docChanged && !transaction.getMeta(STREAM_EDITOR_META)) {
        onDocChanged(view, transaction);
      }
    },

    attributes,
    handleKeyDown(_view, event) {
      return inlineRichText && event.key === "Enter";
    },
  });

  const previewCursor = () => {
    const field = streamSource && currentEditableField(streamSource);
    const syncState = streamSource && ySyncPluginKey.getState(streamSource.instance.view.state);
    if (!field || !syncState?.type || !syncState?.binding?.mapping) return null;

    const fieldStart = field.pos + 1;
    return {
      anchor: absolutePositionToRelativePosition(
        fieldStart + view.state.selection.anchor,
        syncState.type,
        syncState.binding.mapping,
      ),
      head: absolutePositionToRelativePosition(
        fieldStart + view.state.selection.head,
        syncState.type,
        syncState.binding.mapping,
      ),
    };
  };

  // Sends on refocus callback
  function sendCursor() {
    const articleBlock = view.dom.closest(ARTICLE_BLOCK_SELECTOR);
    const descriptor = articleBlock && describeArticleBlock(articleBlock);
    if (!descriptor) return;
    selectArticleBlockElement(articleBlock);

    const editors = [articleBlock, ...articleBlock.querySelectorAll(".ProseMirror")]
      .filter((element) => element.matches(".ProseMirror"));
    
    manuscriptSession.users?.sendSelection({
      ...descriptor,
      cursor: view.state.selection.head,
      from: view.state.selection.from,
      to: view.state.selection.to,
      path: streamSource?.path || null,
      previewCursor: previewCursor(),
      editorIndex: editors.indexOf(view.dom),
    });
  }

  view.streamSource = streamSource;
  view.dom.addEventListener("focus", () => {
    manuscriptSession.richTextToolbar?.setView(view);
    sendCursor();
  }, true);

  return {
    view,
    destroy() {
      view.destroy();
    },
  };
}

export function destroyEditorViews(editors) {
  for (const editor of editors) editor.destroy();
  editors.length = 0;
  manuscriptSession.richTextToolbar?.setView(null);
  manuscriptSession.commentSidebar?.update();
  manuscriptSession.footnoteSidebar?.update();
}

export function destroyEditorViewsWithin(editors, root) {
  let destroyed = false;
  for (let index = editors.length - 1; index >= 0; index -= 1) {
    const editorRoot = editors[index].view.dom;
    if (editorRoot !== root && !root.contains(editorRoot)) continue;
    editors[index].destroy();
    editors.splice(index, 1);
    destroyed = true;
  }
  if (destroyed) {
    manuscriptSession.commentSidebar?.update();
    manuscriptSession.footnoteSidebar?.update();
  }
}

function richTextContentFromHtml(html) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html || "";
  return ProseMirrorDOMParser.fromSchema(richTextSchema).parse(wrapper).toJSON().content || EMPTY_RICH_TEXT;
}

function richTextHtmlFromDoc(doc) {
  const wrapper = document.createElement("div");
  wrapper.appendChild(DOMSerializer.fromSchema(richTextSchema).serializeFragment(doc.content));
  return wrapper.innerHTML;
}

function inlineRichTextHtmlFromDoc(doc) {
  const wrapper = document.createElement("div");
  const serializer = DOMSerializer.fromSchema(richTextSchema);
  doc.forEach((node, _offset, index) => {
    if (index) wrapper.appendChild(document.createElement("br"));
    wrapper.appendChild(serializer.serializeFragment(node.content));
  });
  return wrapper.innerHTML;
}

// Calculates text offset within a plaintext editable root node
function textOffsetWithin(root, node, offset) {
  if (!node || (node !== root && !root.contains(node))) return 0;
  const range = document.createRange();
  range.selectNodeContents(root);
  try {
    range.setEnd(node, offset);
  } catch (_error) {
    return 0;
  }
  return range.toString().length;
}

function sendPlainTextCursor(target) {
  const articleBlock = target.closest(ARTICLE_BLOCK_SELECTOR);
  const descriptor = articleBlock && describeArticleBlock(articleBlock);
  const selection = target.getRootNode()?.getSelection?.() || target.ownerDocument.getSelection();
  if (!descriptor || !selection || !target.contains(selection.anchorNode) || !target.contains(selection.focusNode)) return;
  selectArticleBlockElement(articleBlock);

  const anchorOffset = textOffsetWithin(target, selection.anchorNode, selection.anchorOffset);
  const focusOffset = textOffsetWithin(target, selection.focusNode, selection.focusOffset);
  const editors = [articleBlock, ...articleBlock.querySelectorAll(".pm-manuscript-direct-plain-text")]
    .filter((element) => element.matches(".pm-manuscript-direct-plain-text"));
  manuscriptSession.users?.sendSelection({
    ...descriptor,
    kind: "plainText",
    cursor: focusOffset,
    from: Math.min(anchorOffset, focusOffset),
    to: Math.max(anchorOffset, focusOffset),
    editorIndex: editors.indexOf(target),
  });
}

// Prevents direct edit events from causing refreshes of the preview
function stopDirectEditEvents(target) {
  target.addEventListener("input", (event) => { event.stopPropagation(); });
}

export function syncDirectPageEditorsFromMetadata(manuscriptRoot, event) {
  const { name, value, remote = false } = event.detail || {};
  if (!name) return;

  const selector = `[data-article-editable-page-field="${window.CSS.escape(name)}"]`;
  const htmlValue = String(value ?? "");
  const syncedRichTextEditors = new Set();

  manuscriptSession.articleDirectTextEditors.forEach((editor) => {
    const target = editor.view.dom;
    if (target.dataset.articleEditablePageField !== name) return;
    syncedRichTextEditors.add(target);
    if (!remote && editor.view.hasFocus()) return;

    const nextDoc = editor.view.state.schema.nodeFromJSON({
      type: "doc",
      content: richTextContentFromHtml(htmlValue),
    });
    if (editor.view.state.doc.eq(nextDoc)) return;

    editor.view.dispatch(editor.view.state.tr
      .replaceWith(0, editor.view.state.doc.content.size, nextDoc.content)
      .setMeta(STREAM_EDITOR_META, true)
      .setMeta("addToHistory", false));
  });

  manuscriptRoot.querySelectorAll(selector).forEach((target) => {
    if (syncedRichTextEditors.has(target)) return;
    if (target.matches(".pm-manuscript-direct-rich-text")) return;
    if (!remote && target.getRootNode()?.activeElement === target) return;

    const nextText = htmlValue.replace(/<[^>]*>/g, "").trim();
    if (target.textContent !== nextText) target.textContent = nextText;
  });
}

// Mounts richtext and plaintext editors on the preview including inline/direct
export function setupArticlePreviewEditors(manuscriptRoot, streamDocs = null, scopeBlock = null) {
  if (!manuscriptRoot) return;

  refreshBlockCommentBorders(manuscriptRoot);

  // Inline RichText Editors
  const articleBlocksByField = new Map();
  const previewBlocks = scopeBlock
    ? [scopeBlock, ...scopeBlock.querySelectorAll(ARTICLE_BLOCK_SELECTOR)].filter((block) => block.matches(ARTICLE_BLOCK_SELECTOR))
    : Array.from(manuscriptRoot.querySelectorAll(ARTICLE_BLOCK_SELECTOR));
  for (const articleBlock of previewBlocks) {
    const blocks = articleBlocksByField.get(articleBlock.dataset.streamField) || [];
    blocks.push(articleBlock);
    articleBlocksByField.set(articleBlock.dataset.streamField, blocks);
  }

  for (const instance of manuscriptSession.streamEditors) {
    const articleBlocks = articleBlocksByField.get(instance.fieldName) || [];
    const doc = streamDocs?.get(instance.fieldName) || instance.view.state.doc.toJSON();

    (doc.content || []).forEach((block, blockIndex) => {
      const field = (block.content || []).find((child) => (
        child.type === "editable_field" &&
        child.attrs?.mode === "richtext" &&
        samePath(child.attrs?.path, [])
      ));
      if (block.attrs?.blockType !== "richtext" || !field || (block.content || []).some((child) => child.type === "control_field")) return;

      const blockId = block.attrs?.id;
      const articleBlock = (blockId && articleBlocks.find((element) => element.dataset.streamBlockId === String(blockId))) || articleBlocks.find((element) => Number(element.dataset.streamBlockIndex) === blockIndex);
      if (!articleBlock) return;

      const streamSource = {
        instance,
        blockId,
        blockIndex,
        path: field.attrs?.path || [],
      };
      const editor = createArticleRichTextEditor(
        articleBlock,
        field.content,
        `${articleBlock.className} pm-manuscript-rich-text`,
        (activeView, transaction) => {
          projectInlineTransaction(streamSource, activeView, transaction);
        },
        streamSource,
      );
      manuscriptSession.articleRichTextEditors.push({
        ...editor,
        fieldName: instance.fieldName,
        blockId,
        blockIndex,
        streamSource,
      });
    });
  }

  // Direct Text Editors
  if (!scopeBlock) {
    destroyEditorViews(manuscriptSession.articleDirectTextEditors);
    manuscriptSession.articleDirectPlainTextEditors = [];
  }
  const directTargets = scopeBlock
    ? [scopeBlock, ...scopeBlock.querySelectorAll(DIRECT_EDITABLE_SELECTOR)].filter((target) => target.matches(DIRECT_EDITABLE_SELECTOR))
    : manuscriptRoot.querySelectorAll(DIRECT_EDITABLE_SELECTOR);
  for (const target of directTargets) {
    const source = directEditableSource(target);
    if (!source) continue;

    if (["richtext", "richtext-inline"].includes(target.dataset.articleEditableMode)) {
      const streamSource = source.kind === "stream" ? source : null;
      const editor = createArticleRichTextEditor(
        target,
        source.kind === "stream" ? source.field.node.toJSON().content : richTextContentFromHtml(source.input.value),
        `${target.className} pm-manuscript-direct-edit pm-manuscript-direct-rich-text`,
        (activeView, transaction) => {
          if (source.kind !== "stream") {
            source.input.value = target.dataset.articleEditableMode === "richtext-inline"
              ? inlineRichTextHtmlFromDoc(activeView.state.doc)
              : richTextHtmlFromDoc(activeView.state.doc);
            source.input.dispatchEvent(new CustomEvent("input", {
              bubbles: true,
              detail: { deferPreviewIfFocused: true },
            }));
            return;
          }

          projectInlineTransaction(streamSource, activeView, transaction);
        },
        streamSource,
      );
      stopDirectEditEvents(editor.view.dom);
      manuscriptSession.articleDirectTextEditors.push({ ...editor, streamSource });
      continue;
    }

    const initialText = source.kind === "stream" ? source.field.textContent : source.input.value;
    target.textContent = String(initialText || "").trim();

    target.classList.add("pm-manuscript-direct-edit", "pm-manuscript-direct-plain-text");
    Object.assign(target, { contentEditable: "plaintext-only" });
    target.setAttribute("role", "textbox");
    target.setAttribute("tabindex", "0");
    stopDirectEditEvents(target);
    const sendCursor = () => { sendPlainTextCursor(target); };
    target.addEventListener("focus", sendCursor);
    target.addEventListener("keyup", sendCursor);
    target.addEventListener("mouseup", sendCursor);

    if (source.kind === "stream") {
      manuscriptSession.articleDirectPlainTextEditors.push({ element: target, streamSource: source });
    }

    target.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        target.blur();
      }
    });
    target.addEventListener("paste", (event) => {
      event.preventDefault();
      document.execCommand("insertText", false, event.clipboardData?.getData("text/plain") || "");
    });
    target.addEventListener("input", () => {
      sendPlainTextCursor(target);
      const activeSource = directEditableSource(target) || source;
      const nextValue = target.textContent.trim();
      if (activeSource.kind !== "stream") {
        activeSource.input.value = nextValue;
        activeSource.input.dispatchEvent(new CustomEvent("input", {
          bubbles: true,
          detail: { deferPreviewIfFocused: true },
        }));
        return;
      }

      const schema = activeSource.instance.view.state.schema;
      writeStreamFieldContent(activeSource, Fragment.fromArray((nextValue ? nextValue.split(/\n{2,}/) : [""]).map((paragraphText) => (
        schema.nodes.paragraph.create(null, paragraphText ? schema.text(paragraphText) : null)
      ))), target);
    });
  }
}
