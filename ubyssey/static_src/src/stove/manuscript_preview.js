// Shadow Dom, preview refresh, history, rich text writeback

import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { editorPlugins, richTextSchema } from "./prosemirror_base";
import { pmDocToStreamValue, clone } from "./stream_serialization";
import { editorState } from "./manuscript_editor";
import { describeArticleBlock, articleBlockDescriptors, findArticleBlock, cleanupArticleBlockControls, setupArticleBlockControls, showSelectedArticleBlockEditor, sameArticleBlock } from "./manuscript_block_controls";

const theme = "light" // Add setting in future

export function setupArticleShadow() {
  const host = document.querySelector("[data-article-shadow]");
  if (!host) {
    return null;
  }

  const articleStylesheets = Array.from(host.querySelectorAll("[data-article-stylesheet]"));
  const articleStylesheetHrefs = articleStylesheets.map((stylesheet) => stylesheet.getAttribute("href")).filter(Boolean);

  for (const stylesheet of articleStylesheets) {
    stylesheet.remove();
  }

  const articleHtml = host.innerHTML;
  host.innerHTML = "";

  const shadowRoot = host.shadowRoot || host.attachShadow({ mode: "open" });
  shadowRoot.innerHTML = "";

  const stylesheets = [
    host.dataset.typekitCss,
    host.dataset.bootstrapCss,
    host.dataset.shadowEditorCss,
    ...articleStylesheetHrefs,
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
  toolbar.className = "pm-manuscript-toolbar";
  shadowBody.appendChild(toolbar);

  const wrapper = document.createElement("main");
  wrapper.className = "article-shadow-preview article";
  wrapper.innerHTML = articleHtml;
  shadowBody.appendChild(wrapper);

  return shadowRoot;
}

function currentStreamDocs() {
  const streamDocs = new Map();
  for (const instance of editorState.streamEditors) {
    streamDocs.set(instance.fieldName, mergeArticleRichText(instance.fieldName, instance.view.state.doc.toJSON()));
  }
  return streamDocs;
}

// Serializes every stream editor into its hidden textarea for preview/save
export function writeStreamTextareas(streamDocs = currentStreamDocs()) {
  for (const instance of editorState.streamEditors) {
    instance.textarea.value = JSON.stringify(pmDocToStreamValue(streamDocs.get(instance.fieldName)), null, 2);
  }

  return streamDocs;
}

// Inline RichText Editors
export function setupArticleRichTextEditors(manuscriptRoot, streamDocs = null) {
  if (!manuscriptRoot) return;

  const articleBlocksByField = new Map();
  for (const articleBlock of manuscriptRoot.querySelectorAll("[data-article-block][data-stream-field]")) {
    const blocks = articleBlocksByField.get(articleBlock.dataset.streamField) || [];
    blocks.push(articleBlock);
    articleBlocksByField.set(articleBlock.dataset.streamField, blocks);
  }

  for (const instance of editorState.streamEditors) {
    const articleBlocks = articleBlocksByField.get(instance.fieldName) || [];
    const doc = streamDocs?.get(instance.fieldName) || instance.view.state.doc.toJSON();

    (doc.content || []).forEach((block, blockIndex) => {
      const field = (block.content || []).find((child) => (
        child.type === "editable_field" &&
        child.attrs?.mode === "richtext" &&
        JSON.stringify(child.attrs?.path || []) === "[]"
      ));

      if (block.attrs?.blockType !== "richtext" || !field || (block.content || []).some((child) => child.type === "control_field")) return;

      const blockId = block.attrs?.id;
      const articleBlock = (
        blockId && articleBlocks.find((element) => element.dataset.streamBlockId === String(blockId))
      ) || articleBlocks.find((element) => Number(element.dataset.streamBlockIndex) === blockIndex);

      if (!articleBlock) return;

      let view;
      view = new EditorView({ mount: articleBlock }, {
        state: EditorState.create({
          doc: richTextSchema.nodeFromJSON({
            type: "doc",
            content: field.content?.length ? field.content : [{ type: "paragraph" }],
          }),
          plugins: editorPlugins(richTextSchema),
        }),

        dispatchTransaction(transaction) {
          view.updateState(view.state.apply(transaction));
          editorState.richTextToolbar?.update();
          if (transaction.docChanged) editorState.schedulePreview({ deferIfManuscriptFocused: true });
        },

        attributes: {
          class: `${articleBlock.className} pm-manuscript-rich-text`,
        },
      });

      view.dom.addEventListener("focus", () => { editorState.richTextToolbar?.setView(view); }, true);

      editorState.articleRichTextEditors.push({
        fieldName: instance.fieldName,
        blockId,
        blockIndex,
        view,
      });
    });
  }
}

function destroyArticleRichTextEditors() {
  for (const editor of editorState.articleRichTextEditors) {
    editor.view.destroy();
  }
  editorState.articleRichTextEditors.length = 0;
  editorState.richTextToolbar?.setView(null);
}

function mergeArticleRichText(fieldName, pmDoc) {
  const nextDoc = clone(pmDoc);
  const blocks = nextDoc.content || [];

  for (const editor of editorState.articleRichTextEditors.filter((item) => item.fieldName === fieldName)) {
    const block = (
      editor.blockId && blocks.find((node) => node.attrs?.id === editor.blockId)
    ) || (!editor.blockId && blocks[editor.blockIndex]);
    const field = (block?.content || []).find((child) => child.type === "editable_field" && child.attrs?.mode === "richtext");

    if (field) {
      field.content = editor.view.state.doc.toJSON().content || [{ type: "paragraph" }];
    }
  }

  return nextDoc;
}

export function setupServerPreviewRefresh(form, manuscriptRoot) {
  if (!form?.dataset.previewUrl || !manuscriptRoot) return;

  let timer = null;
  let controller = null;
  let previewId = 0;
  let previewRevision = 0;
  let deferredManuscriptPreview = false;
  const historySelect = document.querySelector("[data-history-select]");

  editorState.schedulePreview = ({ deferIfManuscriptFocused = false } = {}) => {
    if (historySelect) historySelect.value = "current";
    previewRevision += 1;
    clearTimeout(timer);

    if (deferIfManuscriptFocused && focusedArticleRichText(manuscriptRoot)) {
      deferredManuscriptPreview = true;
      return;
    }

    deferredManuscriptPreview = false;
    timer = setTimeout(sendPreview, 500);
  };

  editorState.cancelPreviewRefresh = () => {
    previewRevision += 1;
    clearTimeout(timer);
    if (controller) controller.abort();
    deferredManuscriptPreview = false;
  };

  const flushDeferredPreview = () => {
    if (!deferredManuscriptPreview || focusedArticleRichText(manuscriptRoot)) return;
    editorState.schedulePreview();
  };

  const scheduleFromForm = (event) => {
    if ((event.composedPath?.() || []).some((element) => element?.matches?.("[data-history-select], .manuscript-topbar, .manuscript-topbar *"))) return;
    if ((event.composedPath?.() || []).some((element) => element?.classList?.contains("pm-manuscript-rich-text"))) return;
    if (editorState.blockEditorModalOpen) return;
    editorState.schedulePreview();
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
        restoreCurrentArticleControls(manuscriptRoot, streamDocs);
      }
    } catch (error) {
      if (error.name !== "AbortError") console.error(error);
    }
  }
}

function focusedArticleRichText(manuscriptRoot) {
  const active = manuscriptRoot?.activeElement;
  return Boolean(active?.closest?.(".pm-manuscript-rich-text, .pm-manuscript-toolbar"));
}

export function setupHistoryPreviewButtons(manuscriptRoot) {
  const form = document.querySelector("[data-manuscript-form]");
  const historyButtons = document.querySelectorAll("[data-history-button]");
  const historySelect = document.querySelector("[data-history-select]");
  if (!form || !manuscriptRoot) return;

  const previewRevision = async (revisionId) => {
    try {
      editorState.cancelPreviewRefresh();
      const isCurrent = revisionId === "current";
      const formData = new FormData(form);
      const streamDocs = isCurrent ? writeStreamTextareas() : null;

      formData.set("revision", revisionId);

      const html = await fetchPreviewHtml(form, formData);
      if (!html || !replaceArticlePreviewHtml(manuscriptRoot, html)) return;

      if (isCurrent) {
        restoreCurrentArticleControls(manuscriptRoot, streamDocs);
      } else {
        editorState.selectedArticleBlock = null;
        showSelectedArticleBlockEditor(null);
      }
    } catch (error) {
      if (error.name !== "AbortError") console.error(error);
    }
  };

  historySelect?.addEventListener("change", (event) => {
    event.stopPropagation();
    previewRevision(historySelect.value);
  });

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

function replaceArticlePreviewHtml(manuscriptRoot, html) {
  const wrapper = manuscriptRoot.querySelector(".article-shadow-preview");
  if (!wrapper) return false;

  destroyArticleRichTextEditors();
  cleanupArticleBlockControls();
  wrapper.innerHTML = html;
  return true;
}

function restoreCurrentArticleControls(manuscriptRoot, streamDocs) {
  setupArticleRichTextEditors(manuscriptRoot, streamDocs);
  setupArticleBlockControls(manuscriptRoot);

  const articleBlock = editorState.selectedArticleBlock && findArticleBlock(manuscriptRoot, editorState.selectedArticleBlock);
  if (articleBlock) {
    editorState.selectedArticleBlock = describeArticleBlock(articleBlock) || editorState.selectedArticleBlock;
  } else if (
    editorState.selectedArticleBlock &&
    !articleBlockDescriptors().some((item) => sameArticleBlock(item, editorState.selectedArticleBlock))
  ) {
    editorState.selectedArticleBlock = null;
  }

  showSelectedArticleBlockEditor(editorState.selectedArticleBlock);
}
