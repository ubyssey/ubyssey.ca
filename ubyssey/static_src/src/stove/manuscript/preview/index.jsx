// Handles server rendered previews
// Creates RichText editors directly over preview elements
// Merges edits within preview to form inputs/stream docs
// Previewing Historical Revisions as well

import { DOMParser as ProseMirrorDOMParser, DOMSerializer, Fragment } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { ACTIVE_SUGGESTION_THREAD_META, editorPlugins, richTextSchema } from "../rich_text/index.jsx";
import { topLevelBlockInfoByIdOrIndex } from "../stream/index.jsx";
import { manuscriptSession } from "../session.js";
import { articleBlockDescriptors, describeArticleBlock, findArticleBlock, refreshBlockCommentBorders, sameArticleBlock, setupArticleBlockControls, showSelectedArticleBlockEditor } from "../blocks/controller.jsx";
import { writeStreamTextareas } from "./persistence.js";

export { mountManuscriptChrome } from "../chrome/index.jsx";
export { setupArticleShadow } from "./shadow_root.js";
export { writeStreamTextareas } from "./persistence.js";

const ARTICLE_BLOCK_SELECTOR = "[data-article-block][data-stream-field]";
const DIRECT_EDITABLE_SELECTOR = "[data-article-editable-page-field], [data-article-editable-featured-media-field], [data-article-editable-stream-field][data-article-editable-path]";
const EMPTY_RICH_TEXT = [{ type: "paragraph" }];

// We marked the actual article HTML with content-editable for prosemirror
function createArticleRichTextEditor(mount, content, className, onDocChanged) {
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
      manuscriptSession.richTextToolbar?.update();
      if (activeSuggestionThreadId) manuscriptSession.commentSidebar?.activateThread(activeSuggestionThreadId);
      else manuscriptSession.commentSidebar?.update();
      manuscriptSession.footnoteSidebar?.update();
      if (transaction.docChanged) onDocChanged(view, transaction);
    },

    attributes,
  });
  view.dom.addEventListener("focus", () => { manuscriptSession.richTextToolbar?.setView(view); }, true);
  return {
    view,
    destroy() {
      view.destroy();
    },
  };
}

function destroyEditorViews(editors) {
  for (const editor of editors) editor.destroy();
  editors.length = 0;
  manuscriptSession.richTextToolbar?.setView(null);
  manuscriptSession.commentSidebar?.update();
  manuscriptSession.footnoteSidebar?.update();
}

// Resolves directly editable preview element to backing Node for streamfield content, page/featured media fields resolve to form inputs
// The backing node is what is used for writeback in persistence.js
function directEditableSource(target, { allowPage = true } = {}) {
  const instance = manuscriptSession.streamEditors.find((item) => item.fieldName === target.dataset.articleEditableStreamField);
  const articleBlock = target.closest?.(ARTICLE_BLOCK_SELECTOR);
  const paths = editablePaths(target);
  const block = instance && articleBlock && paths.length && topLevelBlockInfoByIdOrIndex(instance.view.state.doc, articleBlock.dataset.streamBlockId, Number(articleBlock.dataset.streamBlockIndex));
  const field = block && paths.map((path) => editableFieldInfo(block, path)).find(Boolean);
  const streamSource = field && { kind: "stream", instance, block, field };
  const pageFieldName = target.dataset.articleEditablePageField;
  const featuredMediaFieldName = target.dataset.articleEditableFeaturedMediaField;
  const form = (allowPage && document.querySelector("[data-manuscript-form]")) || null;
  const pageInput = formInput(form, pageFieldName);
  const featuredMediaInput = formInput(form, featuredMediaFieldName && `featured_media-${featuredMediaFieldName}`);
  const inputSource = (pageInput && { kind: "page", input: pageInput }) || (featuredMediaInput && { kind: "featured_media", input: featuredMediaInput });
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

data-article-editable-featured-media-field
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

function parseEditablePath(path) {
  return path === "" ? [] : path.split(".").map((part) => /^\d+$/.test(part) ? Number(part) : part);
}

function editableFieldInfo(block, path) {
  const match = editableFieldInfoInNode(block.node, path);
  return match && {
    ...match,
    pos: block.start + 1 + match.pos,
  };
}

function editableFieldInfoInNode(parent, targetPath, pathPrefix = [], startPos = 0) {
  let offset = 0;

  for (let index = 0; index < parent.childCount; index += 1) {
    const node = parent.child(index);
    const pos = startPos + offset;

    if (node.type.name === "editable_field") {
      const path = pathPrefix.concat(node.attrs?.path || []);
      if (samePath(path, targetPath)) return { node, path, pos, textContent: node.textContent || "" };
    } else if (node.type.name === "list_field") {
      const match = editableFieldInfoInListField(node, targetPath, pathPrefix.concat(node.attrs?.path || []), pos + 1);
      if (match) return match;
    } else if (node.childCount) {
      const match = editableFieldInfoInNode(node, targetPath, pathPrefix, pos + 1);
      if (match) return match;
    }

    offset += node.nodeSize;
  }

  return null;
}

function editableFieldInfoInListField(listField, targetPath, listPath, startPos) {
  let offset = 0;

  for (let index = 0; index < listField.childCount; index += 1) {
    const item = listField.child(index);
    const itemPos = startPos + offset;
    const itemPath = listPath.concat(index);
    const match = editableFieldInfoInNode(item, targetPath, itemPath, itemPos + 1);
    if (match) return match;
    offset += item.nodeSize;
  }

  return null;
}

function samePath(left = [], right = []) {
  return JSON.stringify(left || []) === JSON.stringify(right || []);
}

function writeStreamFieldContent(source, fragment) {
  const { view } = source.instance;
  const latestBlock = topLevelBlockInfoByIdOrIndex(view.state.doc, source.block.node.attrs?.id, source.block.index);
  const latestField = latestBlock && editableFieldInfo(latestBlock, source.field.path || source.field.node.attrs?.path || []);
  if (latestField) {
    view.dispatch(view.state.tr
      .replaceWith(latestField.pos + 1, latestField.pos + 1 + latestField.node.content.size, fragment)
      .setMeta("skipPreview", true));
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

function stopDirectEditEvents(target) {
  target.addEventListener("input", (event) => { event.stopPropagation(); });
}

export function setupServerPreviewRefresh(form, manuscriptRoot) {
  if (!form?.dataset.previewUrl || !manuscriptRoot) return;

  let timer = null;
  let controller = null;
  let previewId = 0;
  let previewRevision = 0;
  let deferredManuscriptPreview = false;
  const historySelect = document.querySelector("[data-history-select]");

  manuscriptSession.schedulePreview = ({ deferIfManuscriptFocused = false, immediate = false } = {}) => {
    if (historySelect) historySelect.selectedIndex = 0;
    previewRevision += 1;
    clearTimeout(timer);

    if (deferIfManuscriptFocused && focusedArticleRichText(manuscriptRoot)) {
      deferredManuscriptPreview = true;
      return;
    }

    deferredManuscriptPreview = false;
    timer = setTimeout(sendPreview, immediate ? 0 : 500);
  };

  manuscriptSession.cancelPreviewRefresh = () => {
    previewRevision += 1;
    clearTimeout(timer);
    if (controller) controller.abort();
    deferredManuscriptPreview = false;
  };

  const flushDeferredPreview = () => {
    if (manuscriptSession.blockEditorModalOpen) return;
    if (!deferredManuscriptPreview || focusedArticleRichText(manuscriptRoot)) return;
    manuscriptSession.schedulePreview();
  };

  const scheduleFromForm = (event) => {
    if ((event.composedPath?.() || []).some((element) => element?.matches?.("[data-history-select], .manuscript-topbar, .manuscript-topbar *"))) return;
    if ((event.composedPath?.() || []).some((element) => element?.matches?.(".pm-manuscript-rich-text, .pm-manuscript-direct-edit"))) return;
    if (manuscriptSession.blockEditorModalOpen) return;
    manuscriptSession.schedulePreview();
  };

  form.addEventListener("input", scheduleFromForm);
  form.addEventListener("change", scheduleFromForm);
  manuscriptRoot.addEventListener("focusout", () => { setTimeout(flushDeferredPreview, 0); });

  async function sendPreview() {
    const streamDocs = writeStreamTextareas();

    if (controller) controller.abort();
    controller = new AbortController();
    const currentPreviewId = ++previewId;
    const requestRevision = previewRevision;

    try {
      const html = await fetchPreviewHtml(form, new FormData(form), controller.signal);
      if (currentPreviewId !== previewId || requestRevision !== previewRevision || !html) return;

      if (replaceArticlePreviewHtml(manuscriptRoot, html)) {
        const reveal = manuscriptSession.revealSelectedArticleBlock;
        restoreCurrentArticleControls(manuscriptRoot, streamDocs);
        if (reveal) {
          manuscriptSession.revealSelectedArticleBlock = null;
          window.requestAnimationFrame(() => {
            const articleBlock = findArticleBlock(manuscriptRoot, reveal);
            articleBlock?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        }
      }
    } catch (error) {
      if (error.name !== "AbortError") console.error(error);
    }
  }
}

function focusedArticleRichText(manuscriptRoot) {
  const active = manuscriptRoot?.activeElement;
  return Boolean(active?.closest?.(".pm-manuscript-rich-text, .pm-manuscript-direct-edit, .pm-manuscript-toolbar"));
}

// Lazy loading Revision History
async function loadRevisionHistory(form, historySelect) {
  if (!form.dataset.historyUrl || !historySelect) return;

  try {
    const response = await fetch(form.dataset.historyUrl, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`History request failed status ${response.status}`);
    }

    const options = (payload.revisions || []).map((revision) => {
      const option = document.createElement("option");
      option.value = revision.id;
      option.textContent = revision.label;
      return option;
    });

    historySelect.replaceChildren(...options);
    historySelect.disabled = false;
  } catch (error) {
    console.error(error);
    historySelect.options[0].textContent = "Failed to fetch history";
  }
}

export function setupHistoryPreviewButtons(manuscriptRoot) {
  const form = document.querySelector("[data-manuscript-form]");
  const historyButtons = document.querySelectorAll("[data-history-button]");
  const historySelect = document.querySelector("[data-history-select]");
  const restoreButton = document.querySelector("[data-history-restore]");
  const returnButton = document.querySelector("[data-history-return]");
  if (!form || !manuscriptRoot) return;
  let historyPreviewId = 0;
  loadRevisionHistory(form, historySelect);

  const selectedRevision = () => historySelect?.value || "";
  const selectedRevisionIsCurrent = () => !historySelect || historySelect.selectedIndex <= 0;
  const updateHistoryMode = () => {
    form.classList.toggle("manuscript-editor--history", !selectedRevisionIsCurrent());
    if (restoreButton) restoreButton.disabled = selectedRevisionIsCurrent();
  };

  const previewRevision = async (revisionId, isCurrent = false) => {
    const currentPreviewId = ++historyPreviewId;
    try {
      manuscriptSession.cancelPreviewRefresh();
      const formData = new FormData(form);
      const streamDocs = isCurrent ? writeStreamTextareas() : null;

      if (!isCurrent) formData.set("revision", revisionId);

      const html = await fetchPreviewHtml(form, formData);
      if (currentPreviewId !== historyPreviewId || !html || !replaceArticlePreviewHtml(manuscriptRoot, html)) return;

      if (isCurrent) {
        restoreCurrentArticleControls(manuscriptRoot, streamDocs);
      } else {
        manuscriptSession.selectedArticleBlock = null;
        showSelectedArticleBlockEditor(null);
      }
    } catch (error) {
      if (error.name !== "AbortError") console.error(error);
    }
  };

  historySelect?.addEventListener("change", (event) => {
    event.stopPropagation();
    updateHistoryMode();
    previewRevision(historySelect.value, selectedRevisionIsCurrent());
  });

  returnButton?.addEventListener("click", () => {
    historySelect.selectedIndex = 0;
    historySelect.dispatchEvent(new Event("change", { bubbles: true }));
  });

  restoreButton?.addEventListener("click", async () => {
    const revisionId = selectedRevision();
    if (!form.dataset.restoreUrl || selectedRevisionIsCurrent()) return;
    if (!window.confirm("Restore this version as the current draft?")) return;
    
    const originalText = restoreButton.textContent;
    restoreButton.disabled = true;
    restoreButton.textContent = "Restoring...";
    try {
      const formData = new FormData(form);
      formData.set("revision", revisionId);
      const response = await fetch(form.dataset.restoreUrl, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      const payload = await response.json();
      if (!response.ok || payload.errors) {
        const message = payload.errors
          ? Object.entries(payload.errors)
            .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`)
            .join("\n")
          : "Failed to restore version.";
        // todo replace alerts with modal maybe
        alert(message);
        return;
      }
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Failed to restore version.");
    } finally {
      restoreButton.textContent = originalText;
      updateHistoryMode();
    }
  });

  updateHistoryMode();

  for (const btn of historyButtons) {
    btn.addEventListener("click", () => { previewRevision(btn.dataset.revisionId); });
  }
}

async function fetchPreviewHtml(form, formData, signal = null) {
  const response = await fetch(form.dataset.previewUrl, {
    method: "POST",
    body: formData,
    credentials: "same-origin",
    signal,
  });
  const payload = await response.json();
  return response.ok && payload.html ? payload.html : null;
}

export function setupArticlePreviewEditors(manuscriptRoot, streamDocs = null) {
  if (!manuscriptRoot) return;

  if (!manuscriptSession.articleBlockControls) setupArticleBlockControls(manuscriptRoot);
  else refreshBlockCommentBorders(manuscriptRoot);

  // Inline RichText Editors
  const articleBlocksByField = new Map();
  for (const articleBlock of manuscriptRoot.querySelectorAll(ARTICLE_BLOCK_SELECTOR)) {
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

      const editor = createArticleRichTextEditor(articleBlock, field.content, `${articleBlock.className} pm-manuscript-rich-text`, () => {});
      manuscriptSession.articleRichTextEditors.push({ ...editor, fieldName: instance.fieldName, blockId, blockIndex });
    });
  }

  // Direct Text Editors
  destroyEditorViews(manuscriptSession.articleDirectTextEditors);
  for (const target of manuscriptRoot.querySelectorAll(DIRECT_EDITABLE_SELECTOR)) {
    const source = directEditableSource(target);
    if (!source) continue;

    if (target.dataset.articleEditableMode === "richtext") {
      const editor = createArticleRichTextEditor(
        target,
        source.kind === "stream" ? source.field.node.toJSON().content : richTextContentFromHtml(source.input.value),
        `${target.className} pm-manuscript-direct-edit pm-manuscript-direct-rich-text`,
        (activeView) => {
          if (source.kind !== "stream") {
            source.input.value = richTextHtmlFromDoc(activeView.state.doc);
            return;
          }

          const schema = source.instance.view.state.schema;
          writeStreamFieldContent(source, Fragment.fromArray((activeView.state.doc.toJSON().content || EMPTY_RICH_TEXT).map((node) => schema.nodeFromJSON(node))));
        },
      );
      stopDirectEditEvents(editor.view.dom);
      manuscriptSession.articleDirectTextEditors.push(editor);
      continue;
    }

    const initialText = source.kind === "stream" ? source.field.textContent : source.input.value;
    target.textContent = String(initialText || "").trim();

    target.classList.add("pm-manuscript-direct-edit", "pm-manuscript-direct-plain-text");
    Object.assign(target, { contentEditable: "plaintext-only" });
    target.setAttribute("role", "textbox");
    target.setAttribute("tabindex", "0");
    stopDirectEditEvents(target);

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
      const activeSource = directEditableSource(target) || source;
      const nextValue = target.textContent.trim();
      if (activeSource.kind !== "stream") {
        activeSource.input.value = nextValue;
        return;
      }

      const schema = activeSource.instance.view.state.schema;
      writeStreamFieldContent(activeSource, Fragment.fromArray((nextValue ? nextValue.split(/\n{2,}/) : [""]).map((paragraphText) => (
        schema.nodes.paragraph.create(null, paragraphText ? schema.text(paragraphText) : null)
      ))));
    });
  }
}

function replaceArticlePreviewHtml(manuscriptRoot, html) {
  const content = manuscriptRoot.querySelector("[data-article-preview-content]");
  if (!content) return false;

  destroyEditorViews(manuscriptSession.articleDirectTextEditors);
  destroyEditorViews(manuscriptSession.articleRichTextEditors);
  content.innerHTML = html;
  return true;
}

function restoreCurrentArticleControls(manuscriptRoot, streamDocs) {
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

  showSelectedArticleBlockEditor(manuscriptSession.selectedArticleBlock);
  if (articleBlock) {
    articleBlock.classList.add("pm-article-block--selected");
    manuscriptSession.articleBlockControls?.setActive?.(articleBlock);
  }
  manuscriptSession.commentSidebar?.update();
  manuscriptSession.footnoteSidebar?.update();
}
