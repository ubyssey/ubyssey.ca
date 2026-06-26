// Entrypoint

import { createEditorToolbar } from "./prosemirror_base";
import { createStreamEditor } from "./stream_editor";
import { showSelectedArticleBlockEditor, setupArticleBlockKeyboard } from "./manuscript_block_controls";
import { setupMediaUpload, selectMetadataTab } from "./sidebar";
import { setupArticlePreviewEditors, setupArticleShadow, setupHistoryPreviewButtons, setupServerPreviewRefresh, writeStreamTextareas } from "./manuscript_preview";

export const editorState = {
  streamEditors: [],
  articleRichTextEditors: [],
  articleDirectTextEditors: [],
  articleBlockControls: null,
  richTextToolbar: null,
  selectedArticleBlock: null,
  suppressedHoverArticleBlock: null,
  suppressedHoverTimer: null,
  preferredInsertTypes: new Map(),
  schedulePreview: () => {},
  cancelPreviewRefresh: () => {},
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
        onDocChanged: ({ transaction }) => {
          if (!editorState.blockEditorModalOpen) {
            editorState.schedulePreview({ deferIfManuscriptFocused: Boolean(transaction.getMeta("deferPreviewIfFocused")) });
          }
        },
        onTransaction: () => { showSelectedArticleBlockEditor(editorState.selectedArticleBlock); },
      },
    ));
  }

  editorState.richTextToolbar = createEditorToolbar(manuscriptRoot?.querySelector(".pm-manuscript-toolbar"), {
    publishSource: document.querySelector("[data-article-toolbar-source]"),
  });

  setupArticlePreviewEditors(manuscriptRoot);
  setupArticleBlockKeyboard(manuscriptRoot);
  setupMediaUpload();

  for (const tab of document.querySelectorAll("[data-metadata-tab]")) {
    tab.addEventListener("click", () => { selectMetadataTab(tab.dataset.metadataTab); });
  }

  const form = document.querySelector("[data-manuscript-form]");
  setupServerPreviewRefresh(form, manuscriptRoot);
  setupHistoryPreviewButtons(manuscriptRoot);

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitter = event.submitter || form.querySelector('[data-article-action="draft"]');
      const originalText = submitter?.textContent;
      const saveButtons = form.querySelectorAll("[data-article-action]");

      writeStreamTextareas();
      const formData = new FormData(form);
      if (submitter?.name) formData.set(submitter.name, submitter.value);

      for (const button of saveButtons) button.disabled = true;
      if (submitter) submitter.textContent = "Saving...";

      try {
        const saveUrl = form.getAttribute("action") || window.location.href;
        const response = await fetch(saveUrl, {
          method: "POST",
          body: formData,
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
        });
        const isJson = (response.headers.get("content-type") || "").includes("application/json");
        const payload = isJson ? await response.json() : {};

        if (!response.ok || payload.errors) {
          const message = payload.errors
            ? Object.entries(payload.errors)
              .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`)
              .join("\n")
            : `Save failed with status ${response.status}: ${saveUrl}`;
          alert(message);
          return;
        }

        const historySelect = document.querySelector("[data-history-select]");
        if (historySelect && payload.revision?.id) {
          const revisionId = String(payload.revision.id);
          const exists = Array.from(historySelect.options).some((option) => option.value === revisionId);
          if (!exists) {
            const option = document.createElement("option");
            option.value = revisionId;
            option.textContent = payload.revision.label || `Revision ${revisionId}`;
            historySelect.insertBefore(option, historySelect.options[1] || null);
          }
          historySelect.value = "current";
        }

        if (submitter) {
          submitter.textContent = payload.action === "publish" ? "Published" : "Saved";
          window.setTimeout(() => { submitter.textContent = originalText; }, 1400);
        }
      } catch (error) {
        console.error(error);
        alert("Failed to save.");
      } finally {
        for (const button of saveButtons) button.disabled = false;
        if (submitter?.textContent === "Saving...") submitter.textContent = originalText;
      }
    });
  }
});
