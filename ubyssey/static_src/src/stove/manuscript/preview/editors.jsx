// Preview editor setup, and direct edit sync

import { DOMParser as ProseMirrorDOMParser, DOMSerializer, Fragment } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { yCursorPlugin, ySyncPlugin } from "y-prosemirror";
import { ACTIVE_SUGGESTION_THREAD_META, editorPlugins, richTextSchema } from "../rich_text/index.jsx";
import { handleStreamRichTextKeyDown } from "../rich_text/block_commands.js";
import { manuscriptSession } from "../session.js";
import { refreshBlockCommentBorders, setupArticleBlockControls } from "../blocks/controller.jsx";
import { ARTICLE_BLOCK_SELECTOR, DIRECT_EDITABLE_SELECTOR, EMPTY_RICH_TEXT, SYNCED_EDITOR_META } from "./constants.js";
import { currentEditableField, directEditableSource, samePath, sharedFieldType } from "./sources.js";
import { manuscriptRichTextSchema, streamSchema } from "../stream/schema.js";

// We marked the actual article HTML with content-editable for prosemirror
function createArticleRichTextEditor(mount, content, className, onContentChanged = null, streamSource = null, sharedType = null) {
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

  // Two editor modes, manuscriptRichText for RichText Blocks, uses YJS cursor/history/sync plugin
  // And richTextSchema for modals, which works the same as before pretty much, with Prosemirror history writebacks use onContentChanged
  const schema = sharedType ? manuscriptRichTextSchema : richTextSchema;
  const doc = schema.nodeFromJSON({
    type: sharedType ? "editable_field" : "doc",
    attrs: sharedType ? currentEditableField(streamSource)?.node.attrs : undefined,
    content: content?.length ? content : EMPTY_RICH_TEXT,
  });
  let view;
  view = new EditorView({ mount }, {
    state: EditorState.create({
      doc,
      plugins: [
        ...(sharedType ? [ySyncPlugin(sharedType)] : []),
        ...(sharedType && manuscriptSession.awareness ? [yCursorPlugin(manuscriptSession.awareness)] : []),
        ...editorPlugins(schema, { includeHistory: !sharedType }),
      ],
    }),

    dispatchTransaction(transaction) {
      const activeView = this;
      const activeSuggestionThreadId = transaction.getMeta(ACTIVE_SUGGESTION_THREAD_META);
      const nextState = activeView.state.apply(transaction);
      if (activeView.isDestroyed) return;
      activeView.updateState(nextState);
      if (activeSuggestionThreadId) manuscriptSession.commentSidebar?.activateThread(activeSuggestionThreadId);
      manuscriptSession.scheduleEditorUiRefresh();
      if (onContentChanged && transaction.docChanged && !transaction.getMeta(SYNCED_EDITOR_META)) {
        onContentChanged(activeView, transaction);
      }
    },

    attributes,
    handleKeyDown(activeView, event) {
      if (inlineRichText && event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        return true;
      }
      return handleStreamRichTextKeyDown(activeView, event, streamSource);
    },
  });
  const unregisterSharedType = sharedType ? streamSource.instance.registerRichTextType(sharedType) : null;

  view.streamSource = streamSource;
  const handleFocus = () => {
    streamSource?.instance.history.stopCapturing();
    manuscriptSession.richTextToolbar?.setView(view);
  };
  view.dom.addEventListener("focus", handleFocus, true);

  return {
    view,
    destroy() {
      unregisterSharedType?.();
      view.dom.removeEventListener("focus", handleFocus, true);
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
      .setMeta(SYNCED_EDITOR_META, true)
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

export function refreshPlainTextEditorsFromStream(instance) {
  manuscriptSession.articleDirectPlainTextEditors
    .filter((editor) => editor.streamSource.instance === instance)
    .forEach((editor) => {
      const field = currentEditableField(editor.streamSource);
      const nextText = field?.textContent.trim();
      if (nextText !== undefined && editor.element.textContent !== nextText) {
        editor.element.textContent = nextText;
      }
    });
}

// Mounts richtext and plaintext editors on the preview including inline/direct
export function setupArticlePreviewEditors(manuscriptRoot, streamDocs = null, scopeBlock = null) {
  if (!manuscriptRoot) return;

  if (!manuscriptSession.articleBlockControls) setupArticleBlockControls(manuscriptRoot);
  else refreshBlockCommentBorders(manuscriptRoot);

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
    const doc = streamDocs?.get(instance.fieldName) || instance.doc.toJSON();

    (doc.content || []).forEach((block, blockIndex) => {
      const blockId = block.attrs?.id;
      const articleBlock = blockId
        ? articleBlocks.find((element) => element.dataset.streamBlockId === String(blockId))
        : articleBlocks.find((element) => Number(element.dataset.streamBlockIndex) === blockIndex);
      if (articleBlock && blockId) articleBlock.dataset.streamBlockId = String(blockId);
      if (articleBlock) articleBlock.dataset.streamBlockIndex = String(blockIndex);

      const field = (block.content || []).find((child) => (
        child.type === "editable_field" &&
        child.attrs?.mode === "richtext" &&
        samePath(child.attrs?.path, [])
      ));
      if (block.attrs?.blockType !== "richtext" || !field || (block.content || []).some((child) => child.type === "control_field")) return;
      if (!articleBlock) return;

      const streamSource = {
        instance,
        blockId,
        blockIndex,
        path: field.attrs?.path || [],
        manuscriptRichText: true,
      };
      const sharedType = sharedFieldType(streamSource);
      const editor = createArticleRichTextEditor(
        articleBlock,
        field.content,
        `${articleBlock.className} pm-manuscript-rich-text`,
        null,
        streamSource,
        sharedType,
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
      const sharedType = streamSource && sharedFieldType(streamSource);
      const onContentChanged = source.kind === "stream" ? null : (activeView) => {
        source.input.value = target.dataset.articleEditableMode === "richtext-inline"
          ? inlineRichTextHtmlFromDoc(activeView.state.doc)
          : richTextHtmlFromDoc(activeView.state.doc);
        source.input.dispatchEvent(new CustomEvent("input", {
          bubbles: true,
          detail: { deferPreviewIfFocused: true },
        }));
      };
      const editor = createArticleRichTextEditor(
        target,
        source.kind === "stream" ? source.field.node.toJSON().content : richTextContentFromHtml(source.input.value),
        `${target.className} pm-manuscript-direct-edit pm-manuscript-direct-rich-text`,
        onContentChanged,
        streamSource,
        sharedType,
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
    if (source.kind === "stream") {
      manuscriptSession.articleDirectPlainTextEditors.push({ element: target, streamSource: source });
      target.addEventListener("focus", () => {
        source.instance.history.stopCapturing();
      });
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
      const activeSource = source;
      const nextValue = target.textContent.trim();
      if (activeSource.kind !== "stream") {
        activeSource.input.value = nextValue;
        activeSource.input.dispatchEvent(new CustomEvent("input", {
          bubbles: true,
          detail: { deferPreviewIfFocused: true },
        }));
        return;
      }

      const schema = streamSchema;
      activeSource.instance.writeFieldContent(
        activeSource.blockId,
        activeSource.path || [],
        Fragment.from(schema.nodes.paragraph.create(null, nextValue ? schema.text(nextValue) : null)),
      );
    });
  }
}
