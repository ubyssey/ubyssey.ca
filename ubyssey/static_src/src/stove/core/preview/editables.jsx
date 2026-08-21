// Preview editor setup, and direct edit sync

import { DOMParser as ProseMirrorDOMParser, DOMSerializer, Fragment } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { yCursorPlugin, ySyncPlugin } from "y-prosemirror";
import { ACTIVE_SUGGESTION_THREAD_META, editorPlugins } from "../richtext/plugins.js";
import { richTextSchema } from "../richtext/schema.js";
import { createStreamRichTextKeyHandler } from "../prosemirror/stream_richtext.js";
import { pageEditorState } from "../state.js";
import { PAGE_BLOCK_SELECTOR, selectPageBlock } from "./selection.js";
import { createEmptyRichTextBlock } from "../prosemirror/serialization.js";
import { editableFieldInfo, editableFieldInfoForSource, samePath } from "../prosemirror/fields.js";
import { topLevelBlockInfoByIdOrIndex } from "../prosemirror/blocks.js";
import { setFieldContent } from "../prosemirror/document.js";
import { streamRichTextSchema, streamSchema } from "../prosemirror/stream_schema.js";

const DIRECT_EDITABLE_SELECTOR = "[data-article-editable-page-field], [data-article-editable-stream-field][data-article-editable-path]";
const EMPTY_RICH_TEXT = [{ type: "paragraph" }];
const SYNCED_EDITOR_META = "syncedEditor";

const handleStreamRichTextKeyDown = createStreamRichTextKeyHandler({
  state: pageEditorState,
  streamSchema,
  createEmptyRichTextBlock,
  selectBlock: selectPageBlock,
});

// We marked the page preview HTML with content-editable for prosemirror
function createPageRichTextEditor(mount, content, className, onContentChanged = null, streamSource = null, sharedType = null) {
  const inlineRichText = mount.dataset.articleEditableMode === "richtext-inline";
  const attributes = { class: className };
  
  for (const attr of [
    "data-article-block",
    "data-stream-field",
    "data-stream-block-id",
    "data-stream-block-index",
    "data-article-editable-page-field",
    "data-article-editable-stream-field",
    "data-article-editable-path",
    "data-article-editable-path-prefix",
    "data-article-editable-mode",
  ]) {
    if (mount.hasAttribute?.(attr)) attributes[attr] = mount.getAttribute(attr);
  }

  // Two editor modes, streamRichText for RichText Blocks, uses YJS cursor/history/sync plugin
  // And richTextSchema for modals, which works the same as before pretty much, with Prosemirror history writebacks use onContentChanged
  const schema = sharedType ? streamRichTextSchema : richTextSchema;
  const doc = schema.nodeFromJSON({
    type: sharedType ? "editable_field" : "doc",
    attrs: sharedType ? editableFieldInfoForSource(streamSource)?.node.attrs : undefined,
    content: content?.length ? content : EMPTY_RICH_TEXT,
  });

  let view;
  view = new EditorView({ mount }, {
    state: EditorState.create({
      doc,
      plugins: [
        ...(sharedType ? [ySyncPlugin(sharedType)] : []),
        ...(sharedType && pageEditorState.awareness ? [yCursorPlugin(pageEditorState.awareness)] : []),
        ...editorPlugins(schema, { includeHistory: !sharedType }),
      ],
    }),

    dispatchTransaction(transaction) {
      const activeView = this;
      const activeSuggestionThreadId = transaction.getMeta(ACTIVE_SUGGESTION_THREAD_META);
      const nextState = activeView.state.apply(transaction);
      if (activeView.isDestroyed) return;
      activeView.updateState(nextState);
      if (activeSuggestionThreadId) pageEditorState.commentSidebar?.activateThread(activeSuggestionThreadId);
      pageEditorState.scheduleEditorUiRefresh();
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
    pageEditorState.richTextToolbar?.setView(view);
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
  pageEditorState.richTextToolbar?.setView(null);
  pageEditorState.commentSidebar?.update();
  pageEditorState.footnoteSidebar?.update();
}

export function destroyPagePreviewEditors() {
  destroyEditorViews(pageEditorState.pageDirectRichTextEditors);
  destroyEditorViews(pageEditorState.pageRichTextEditors);
  pageEditorState.pageDirectPlainTextEditors = [];
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
    pageEditorState.commentSidebar?.update();
    pageEditorState.footnoteSidebar?.update();
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

export function syncPageEditorsFromMetadata(pageRoot, event) {
  const { name, value, remote = false } = event.detail || {};
  if (!name) return;

  const selector = `[data-article-editable-page-field="${window.CSS.escape(name)}"]`;
  const htmlValue = String(value ?? "");
  const syncedRichTextEditors = new Set();

  pageEditorState.pageDirectRichTextEditors.forEach((editor) => {
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

  pageRoot.querySelectorAll(selector).forEach((target) => {
    if (syncedRichTextEditors.has(target)) return;
    if (target.matches(".pm-page-direct-rich-text")) return;
    if (!remote && target.getRootNode()?.activeElement === target) return;

    const nextText = htmlValue.replace(/<[^>]*>/g, "").trim();
    if (target.textContent !== nextText) target.textContent = nextText;
  });
}

export function refreshPlainTextEditorsFromStream(instance) {
  pageEditorState.pageDirectPlainTextEditors
    .filter((editor) => editor.streamSource.instance === instance)
    .forEach((editor) => {
      const field = editableFieldInfoForSource(editor.streamSource);
      const nextText = field?.textContent.trim();
      if (nextText !== undefined && editor.element.textContent !== nextText) {
        editor.element.textContent = nextText;
      }
    });
}

// Mounts richtext and plaintext editors on the preview including inline/direct
export function setupPagePreviewEditors(pageRoot, streamDocs = null, scopeBlock = null) {
  if (!pageRoot) return;

  // Inline RichText Editors
  const pageBlocksByField = new Map();
  const previewBlocks = scopeBlock ? [scopeBlock, ...scopeBlock.querySelectorAll(PAGE_BLOCK_SELECTOR)].filter((block) => block.matches(PAGE_BLOCK_SELECTOR)) : Array.from(pageRoot.querySelectorAll(PAGE_BLOCK_SELECTOR));
  for (const pageBlock of previewBlocks) {
    const blocks = pageBlocksByField.get(pageBlock.dataset.streamField) || [];
    blocks.push(pageBlock);
    pageBlocksByField.set(pageBlock.dataset.streamField, blocks);
  }

  for (const instance of pageEditorState.streamEditors) {
    const pageBlocks = pageBlocksByField.get(instance.fieldName) || [];
    const doc = streamDocs?.get(instance.fieldName) || instance.doc.toJSON();

    (doc.content || []).forEach((block, blockIndex) => {
      const blockId = block.attrs?.id;
      const pageBlock = blockId
        ? pageBlocks.find((element) => element.dataset.streamBlockId === String(blockId))
        : pageBlocks.find((element) => Number(element.dataset.streamBlockIndex) === blockIndex);

      if (pageBlock && blockId) pageBlock.dataset.streamBlockId = String(blockId);
      if (pageBlock) pageBlock.dataset.streamBlockIndex = String(blockIndex);

      const field = (block.content || []).find((child) => (
        child.type === "editable_field" &&
        child.attrs?.mode === "richtext" &&
        samePath(child.attrs?.path, [])
      ));

      if (block.attrs?.blockType !== "richtext" || !field || (block.content || []).some((child) => child.type === "control_field")) return;
      if (!pageBlock) return;

      const streamSource = {
        instance,
        blockId,
        blockIndex,
        path: field.attrs?.path || [],
        streamRichText: true,
      };

      const sharedType = streamSource.instance.fieldType(streamSource.blockId, streamSource.path || []);

      const editor = createPageRichTextEditor(
        pageBlock,
        field.content,
        `${pageBlock.className} pm-page-rich-text`,
        null,
        streamSource,
        sharedType,
      );
      
      pageEditorState.pageRichTextEditors.push({
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
    destroyEditorViews(pageEditorState.pageDirectRichTextEditors);
    pageEditorState.pageDirectPlainTextEditors = [];
  }
  const directTargets = scopeBlock
    ? [scopeBlock, ...scopeBlock.querySelectorAll(DIRECT_EDITABLE_SELECTOR)].filter((target) => target.matches(DIRECT_EDITABLE_SELECTOR))
    : pageRoot.querySelectorAll(DIRECT_EDITABLE_SELECTOR);

  for (const target of directTargets) {
    const source = directEditableSource(target);
    if (!source) continue;

    if (["richtext", "richtext-inline"].includes(target.dataset.articleEditableMode)) {
      const streamSource = source.kind === "stream" ? source : null;
      const sharedType = streamSource && streamSource.instance.fieldType(streamSource.blockId, streamSource.path || []);
      const onContentChanged = source.kind === "stream" ? null : (activeView) => {
        source.input.value = target.dataset.articleEditableMode === "richtext-inline"
          ? inlineRichTextHtmlFromDoc(activeView.state.doc)
          : richTextHtmlFromDoc(activeView.state.doc);
        source.input.dispatchEvent(new CustomEvent("input", {
          bubbles: true,
          detail: { deferPreviewIfFocused: true },
        }));
      };
      const editor = createPageRichTextEditor(
        target,
        source.kind === "stream" ? source.field.node.toJSON().content : richTextContentFromHtml(source.input.value),
        `${target.className} pm-page-direct-edit pm-page-direct-rich-text`,
        onContentChanged,
        streamSource,
        sharedType,
      );
      stopDirectEditEvents(editor.view.dom);
      pageEditorState.pageDirectRichTextEditors.push({ ...editor, streamSource });
      continue;
    }

    const initialText = source.kind === "stream" ? source.field.textContent : source.input.value;
    target.textContent = String(initialText || "").trim();

    target.classList.add("pm-page-direct-edit", "pm-page-direct-plain-text");
    Object.assign(target, { contentEditable: "plaintext-only" });
    target.setAttribute("role", "textbox");
    target.setAttribute("tabindex", "0");
    stopDirectEditEvents(target);
    if (source.kind === "stream") {
      pageEditorState.pageDirectPlainTextEditors.push({ element: target, streamSource: source });
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
      setFieldContent(activeSource.instance, {
        blockId: activeSource.blockId,
        path: activeSource.path || [],
        content: Fragment.from(schema.nodes.paragraph.create(null, nextValue ? schema.text(nextValue) : null)),
      });
    });
  }
}

// Resolve a preview element to a StreamField or page-form source.

// Grabs data from directly editable sources within preview
// There's a bigger comment below on how this actually works

// Resolves directly editable preview element to backing Node for streamfield content, form fields resolve to form inputs
// The backing node is what is used for writeback in persistence.js
export function directEditableSource(target, { allowPage = true } = {}) {
  const instance = pageEditorState.streamEditors.find((item) => item.fieldName === target.dataset.articleEditableStreamField);
  const pageBlock = target.closest?.(PAGE_BLOCK_SELECTOR);
  const paths = editablePaths(target);
  const block = instance && pageBlock && paths.length && topLevelBlockInfoByIdOrIndex(instance.doc, pageBlock.dataset.streamBlockId, Number(pageBlock.dataset.streamBlockIndex));
  const field = block && paths.map((path) => editableFieldInfo(block, path)).find(Boolean);
  const streamSource = field && {
    kind: "stream",
    instance,
    blockId: block.node.attrs?.id,
    blockIndex: block.index,
    path: field.path,
    field,
    // Makes sure custom RichText actions only happen in preview RichText Blocks
    streamRichText: Boolean(block.node.attrs?.blockType === "richtext" && field.node.attrs?.streamRoot && samePath(field.path, [])),
  };
  const formFieldName = target.dataset.articleEditablePageField;
  const form = (allowPage && document.querySelector("[data-page-form]")) || null;
  const input = formInput(form, formFieldName);
  const inputSource = input && { kind: "form", input };
  return (streamSource && (!inputSource || streamSource.field.textContent.trim())) ? streamSource : inputSource || streamSource;
}

function formInput(form, name) {
  if (!form || !name) return null;
  return form.elements?.namedItem(name) || Element.prototype.querySelector.call(form, `[name="${window.CSS.escape(name)}"]`);
}

// reads data-* attributes from preview and converts to paths pointing to wagtail block value
/*
Example, given this

{
  "headline": "Example headline",
  "image": {
    "alt_text": "A person standing outside"
  },
  "gallery": [
    {
      "caption": "First image"
    }
  ]
}

editable paths here (you use periods between keys) are
headline
image.alt_text

also numeric components use numbers like
gallery.0.caption

so for editable headline, you need
<h3 
  data-article-editable-stream-field="content"
  data-article-editable-path="headline">
  {{ block.value.headline }}
</h3>

you also need an ancestor which identifies which streamfield block it belongs to ie

<section
  data-article-block
  data-stream-field="content"
  data-stream-block-id="{{ block.id }}"
  data-stream-block-index="{{ block_index }}">
  <h3
    data-article-editable-stream-field="content"
    data-article-editable-path="headline">
    {{ block.value.headline }}
  </h3>
</section>

there are also extra ones like

data-article-editable-page-field
data-article-editable-mode="richtext"

I'll move this to a higher level README at some point
*/
function editablePaths(target) {
  if (target.dataset.articleEditablePath === undefined) return [];

  const prefixes = [];
  let element = target.parentElement;

  while (element) {
    if (element.dataset?.articleEditablePathPrefix !== undefined) {
      prefixes.unshift(parseEditablePath(element.dataset.articleEditablePathPrefix));
    }
    element = element.parentElement;
  }

  const prefixPath = prefixes.reduce((parts, prefix) => parts.concat(prefix), []);
  return target.dataset.articleEditablePath.split("|").map((path) => [
    ...prefixPath,
    ...parseEditablePath(path),
  ]);
}

// Parses paths taken from html blocks
function parseEditablePath(path) {
  // Breaks example.0.item into ["example", 0, "item"]
  return path === "" ? [] : path.split(".").map((part) => /^\d+$/.test(part) ? Number(part) : part);
}
