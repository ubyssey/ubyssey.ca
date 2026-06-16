// Entrypoint

import { createEditorToolbar } from "./prosemirror_base";
import { createStreamEditor } from "./stream_editor";
import { setupArticleBlockControls, showSelectedArticleBlockEditor, setupArticleBlockKeyboard } from "./manuscript_block_controls";
import { setupMediaUpload, selectMetadataTab, setupSidebarResize } from "./sidebar";
import { setupArticleShadow, setupHistoryPreviewButtons, setupServerPreviewRefresh, writeStreamTextareas } from "./manuscript_preview";
import { setupArticleRichTextEditors } from "./manuscript_preview";

export const editorState = {
  streamEditors: [],
  articleRichTextEditors: [],
  articleBlockControls: null,
  richTextToolbar: null,
  selectedArticleBlock: null,
  suppressedHoverArticleBlock: null,
  suppressedHoverTimer: null,
  preferredInsertTypes: new Map(),
  schedulePreview: () => {},
};

function readJsonScript(id) {
  return JSON.parse(document.getElementById(id).textContent) || {};
}

document.addEventListener("DOMContentLoaded", () => {
  const manuscriptRoot = setupArticleShadow();
  const streamEditors = readJsonScript("stream-editors");
  const editorErrors = readJsonScript("editor-errors");

  if (Object.keys(editorErrors).length) {
    alert("Failed to save due to errors: " + JSON.stringify(editorErrors));
  }

  const textareas = Array.from(document.querySelectorAll("[data-stream-json]"));
  for (const textarea of textareas) {
    editorState.streamEditors.push(createStreamEditor(
      textarea,
      streamEditors[textarea.dataset.streamField] || {},
      {
        onDocChanged: () => { editorState.schedulePreview(); },
        onTransaction: () => { showSelectedArticleBlockEditor(editorState.selectedArticleBlock); },
      },
    ));
  }

  editorState.richTextToolbar = createEditorToolbar(manuscriptRoot?.querySelector(".pm-manuscript-toolbar"), {
    publishSource: document.querySelector("[data-article-toolbar-source]"),
  });

  setupArticleRichTextEditors(manuscriptRoot);
  setupArticleBlockControls(manuscriptRoot);
  setupArticleBlockKeyboard(manuscriptRoot);
  setupSidebarResize();
  setupMediaUpload();

  for (const tab of document.querySelectorAll("[data-metadata-tab]")) {
    tab.addEventListener("click", () => { selectMetadataTab(tab.dataset.metadataTab); });
  }

  const form = document.querySelector("[data-manuscript-form]");
  setupServerPreviewRefresh(form, manuscriptRoot);
  setupHistoryPreviewButtons(manuscriptRoot);
  form.addEventListener("submit", () => { writeStreamTextareas(); });
});
