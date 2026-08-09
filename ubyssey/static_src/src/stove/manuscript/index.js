// Entrypoint

import { ACTIVE_SUGGESTION_THREAD_META } from "./rich_text/index.jsx";
import { createEditorToolbar } from "./rich_text/toolbar.jsx";
import { setupCommentSidebar, setupFootnoteSidebar } from "./annotations/index.js";
import { createStreamEditor } from "./stream/index.jsx";
import { collectBlockCommentThreads, refreshBlockCommentBorders, syncSelectedArticleBlockEditor, setupArticleBlockKeyboard } from "./blocks/controller.jsx";
import { currentStreamDocs, MODAL_PREVIEW_DEBOUNCE_MS, mountManuscriptChrome, refreshArticlePreviewEditorsFromStream, setupArticlePreviewEditors, setupArticleShadow, setupHistoryPreviewButtons, setupServerPreviewRefresh, syncArticlePreviewEditors, writeStreamTextareas } from "./preview/index.jsx";
import { manuscriptSession } from "./session.js";
import { setupUsers } from "./collab/presence.js";
import { setupCollaboration } from "./collab/collaboration.js";

function readJsonScript(id) {
  return JSON.parse(document.getElementById(id).textContent) || {};
}

document.addEventListener("DOMContentLoaded", async () => {
  const manuscriptRoot = setupArticleShadow();
  const streamEditors = readJsonScript("stream-editors");
  const editorErrors = readJsonScript("editor-errors");
  const form = document.querySelector("[data-manuscript-form]");
  const currentEditor = readJsonScript("current-editor");

  const collaboration = await setupCollaboration(form.dataset.manuscriptPageId, streamEditors, currentEditor, form);
  manuscriptSession.footnoteTexts = collaboration.ydoc.getMap("footnoteTexts");

  if (Object.keys(editorErrors).length) {
    alert("Failed to save due to errors: " + JSON.stringify(editorErrors));
  }

  const textareas = Array.from(document.querySelectorAll("[data-stream-json]"));
  for (const textarea of textareas) {
    manuscriptSession.registerStreamEditor(createStreamEditor(
      textarea,
      streamEditors[textarea.dataset.streamField] || {},
      {
        collaboration: {
          fragment: collaboration.ydoc.getXmlFragment(textarea.dataset.streamField),
          awareness: collaboration.awareness,
        },
        onDocChanged: ({ transaction }) => {
          if (!manuscriptSession.blockEditorEditing && !transaction.getMeta("skipPreview")) {
            manuscriptSession.schedulePreview({ deferIfManuscriptFocused: Boolean(transaction.getMeta("deferPreviewIfFocused")) });
          }
        },
        onTransaction: ({ transaction, instance }) => {
          syncArticlePreviewEditors({ transaction, instance });
          if (transaction.docChanged && manuscriptSession.blockEditorEditing) {
            manuscriptSession.blockEditorDirty = true;
            refreshArticlePreviewEditorsFromStream(instance);
            manuscriptSession.schedulePreview({
              blockOnly: true,
              debounceMs: MODAL_PREVIEW_DEBOUNCE_MS,
            });
          }
          const activeSuggestionThreadId = transaction.getMeta(ACTIVE_SUGGESTION_THREAD_META);
          manuscriptSession.richTextToolbar?.update();
          syncSelectedArticleBlockEditor(manuscriptSession.selectedArticleBlock);
          refreshBlockCommentBorders(manuscriptRoot);
          if (activeSuggestionThreadId) manuscriptSession.commentSidebar?.activateThread(activeSuggestionThreadId);
          else manuscriptSession.commentSidebar?.update();
          manuscriptSession.footnoteSidebar.update();
        },
      },
    ));
  }

  manuscriptSession.richTextToolbar = createEditorToolbar(manuscriptRoot.querySelector(".pm-manuscript-toolbar"), {
    publishSource: document.querySelector("[data-article-toolbar-source]"),
    getContentDoc: () => currentStreamDocs().get("content"),
    onHistoryCommand: () => {
      window.requestAnimationFrame(() => {
        manuscriptSession.schedulePreview({ immediate: true });
      });
    },
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || manuscriptSession.blockEditorModalOpen || event.altKey || (!event.ctrlKey && !event.metaKey)) return;
    if (event.target.closest?.("input, textarea, [contenteditable], .ProseMirror")) return;

    const key = event.key.toLowerCase();
    const action = key === "z" ? (event.shiftKey ? "redo" : "undo") : key === "y" && event.ctrlKey && !event.shiftKey ? "redo" : null;
    if (!action || !manuscriptSession.richTextToolbar.runHistory(action)) return;

    event.preventDefault();
  });

  manuscriptSession.commentSidebar = setupCommentSidebar(document.querySelector("[data-comment-sidebar]"), {
    getViews: () => manuscriptSession.currentArticleTextViews(),
    getThreads: collectBlockCommentThreads,
  });
  manuscriptSession.footnoteSidebar = setupFootnoteSidebar(document.querySelector("[data-footnote-sidebar]"), {
    getViews: () => manuscriptSession.currentArticleTextViews(),
  });

  setupArticlePreviewEditors(manuscriptRoot);
  manuscriptSession.commentSidebar.update();
  manuscriptSession.footnoteSidebar.update();
  setupArticleBlockKeyboard(manuscriptRoot);

  manuscriptSession.users = setupUsers(
    document.querySelector("[data-connected-users]"),
    currentEditor,
    collaboration.awareness,
  );

  setupServerPreviewRefresh(form, manuscriptRoot);

  // Saved Status Indicator
  const savedStatus = document.querySelector("[data-article-saved]");
  let savedStatusTimer = null;

  const formatSavedAt = (date) => date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const updateSavedStatus = () => {
    if (!savedStatus) return;
    savedStatus.textContent = "Saving...";
    manuscriptSession.richTextToolbar?.update();
    clearTimeout(savedStatusTimer);
    savedStatusTimer = window.setTimeout(() => {
      const savedAt = new Date();
      savedStatus.dataset.lastSavedAt = savedAt.toISOString();
      savedStatus.textContent = `Saved: ${formatSavedAt(savedAt)}`;
      manuscriptSession.richTextToolbar?.update();
    }, 750);
  };

  // YJS Collaboration Update Handler
  collaboration.ydoc.on("update", (_update, origin) => {
    updateSavedStatus();
    const remoteUpdate = collaboration.provider && origin === collaboration.provider;
    const localBlockEdit = !remoteUpdate && manuscriptSession.blockEditorEditing;
    if (!remoteUpdate && !localBlockEdit) return;

    if (localBlockEdit) manuscriptSession.blockEditorDirty = true;

    window.requestAnimationFrame(() => {
      manuscriptSession.streamEditors.forEach((instance) => refreshArticlePreviewEditorsFromStream(instance, {
        preserveFocused: true,
      }));
      manuscriptSession.footnoteSidebar?.update();
      if (localBlockEdit) {
        manuscriptSession.schedulePreview({ blockOnly: true, debounceMs: MODAL_PREVIEW_DEBOUNCE_MS });
      } else {
        manuscriptSession.schedulePreview({ deferIfManuscriptFocused: true });
      }
    });
  });

  setupHistoryPreviewButtons(manuscriptRoot);
  mountManuscriptChrome({
    form,
    metadata: collaboration.metadata,
    schedulePreview: (...args) => manuscriptSession.schedulePreview(...args),
    writeBeforeSave: writeStreamTextareas,
  });

  // Prevent Spacebar scrolling
  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space") return;

    const editableSelector = "input, textarea, select, [contenteditable], .ProseMirror";
    const isEditable = (element) => element instanceof Element && Boolean(
      element.closest(editableSelector),
    );
    
    const editable = event.composedPath().some(isEditable);
    if (!editable) event.preventDefault();
  });
});
