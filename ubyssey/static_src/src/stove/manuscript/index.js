// Entrypoint

import { ACTIVE_SUGGESTION_THREAD_META } from "./rich_text/index.jsx";
import { createEditorToolbar } from "./rich_text/toolbar.jsx";
import { setupCommentSidebar, setupFootnoteSidebar } from "./annotations/index.js";
import { createStreamEditor } from "./stream/index.jsx";
import { collectBlockCommentThreads, refreshBlockCommentBorders, setupArticleBlockKeyboard } from "./blocks/controller.jsx";
import { MODAL_PREVIEW_DEBOUNCE_MS, mountManuscriptChrome, reconcilePreviewBlocks, refreshPlainTextEditorsFromStream, setupArticlePreviewEditors, setupArticleShadow, setupHistoryPreviewButtons, setupServerPreviewRefresh, writeStreamTextareas } from "./preview/index.jsx";
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
  manuscriptSession.awareness = collaboration.awareness;
  manuscriptSession.footnoteTexts = collaboration.ydoc.getMap("footnoteTexts");

  if (Object.keys(editorErrors).length) {
    alert("Failed to save due to errors: " + JSON.stringify(editorErrors));
  }

  // Initialized before stream editors, so we can update during setup
  manuscriptSession.commentSidebar = setupCommentSidebar(document.querySelector("[data-comment-sidebar]"), {
    getViews: () => manuscriptSession.currentArticleTextViews(),
    getThreads: collectBlockCommentThreads,
  });
  manuscriptSession.footnoteSidebar = setupFootnoteSidebar(document.querySelector("[data-footnote-sidebar]"), {
    getViews: () => manuscriptSession.currentArticleTextViews(),
  });
  // 100ms debouncwd refresh for toolbar/comments/footnotes, todo convert to proper YJS callbacks
  let editorUiRefreshTimer = null;
  manuscriptSession.scheduleEditorUiRefresh = () => {
    clearTimeout(editorUiRefreshTimer);
    editorUiRefreshTimer = window.setTimeout(() => {
      editorUiRefreshTimer = null;
      manuscriptSession.richTextToolbar?.update();
      manuscriptSession.commentSidebar?.update();
      manuscriptSession.footnoteSidebar?.update();
      refreshBlockCommentBorders(manuscriptRoot);
    }, 100);
  };

  const textareas = Array.from(document.querySelectorAll("[data-stream-json]"));
  for (const textarea of textareas) {
    manuscriptSession.registerStreamEditor(createStreamEditor(
      textarea,
      streamEditors[textarea.dataset.streamField] || {},
      {
        fragment: collaboration.ydoc.getXmlFragment(textarea.dataset.streamField),
        onChange: ({ before, doc, transaction, instance, checkStructure = true, skipPreview = false }) => {
          const blockReconciliation = checkStructure ? reconcilePreviewBlocks({ before, doc, instance }) : { previewReconciled: false, structureChanged: false };
          const previewHandled = (blockReconciliation.previewReconciled || skipPreview || Boolean(transaction?.getMeta("skipPreview")));
          if (manuscriptSession.blockEditorEditing) {
            manuscriptSession.blockEditorDirty = true;
            refreshPlainTextEditorsFromStream(instance);
            manuscriptSession.schedulePreview({
              blockOnly: true,
              debounceMs: MODAL_PREVIEW_DEBOUNCE_MS,
            });
          } else if (!manuscriptSession.blockEditorModalOpen && !previewHandled) {
            manuscriptSession.schedulePreview({
              deferIfManuscriptFocused: true,
              immediate: blockReconciliation.structureChanged,
            });
          }
          manuscriptSession.scheduleEditorUiRefresh();
        },
        onTransaction: ({ transaction }) => {
          const activeSuggestionThreadId = transaction.getMeta(ACTIVE_SUGGESTION_THREAD_META);
          if (activeSuggestionThreadId) manuscriptSession.commentSidebar?.activateThread(activeSuggestionThreadId);
        },
      },
    ));
  }

  manuscriptSession.richTextToolbar = createEditorToolbar(manuscriptRoot.querySelector(".pm-manuscript-toolbar"), {
    publishSource: document.querySelector("[data-article-toolbar-source]"),
    getContentDoc: () => manuscriptSession.streamEditors.find((instance) => instance.fieldName === "content")?.doc,
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || manuscriptSession.blockEditorModalOpen || event.altKey || (!event.ctrlKey && !event.metaKey)) return;
    if (event.target.closest?.("input, textarea, [contenteditable], .ProseMirror")) return;

    const key = event.key.toLowerCase();
    const action = key === "z" ? (event.shiftKey ? "redo" : "undo") : key === "y" && event.ctrlKey && !event.shiftKey ? "redo" : null;
    if (!action || !manuscriptSession.richTextToolbar.runHistory(action)) return;

    event.preventDefault();
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
    manuscriptSession.scheduleEditorUiRefresh();
    clearTimeout(savedStatusTimer);
    savedStatusTimer = window.setTimeout(() => {
      const savedAt = new Date();
      savedStatus.dataset.lastSavedAt = savedAt.toISOString();
      savedStatus.textContent = `Saved: ${formatSavedAt(savedAt)}`;
      manuscriptSession.scheduleEditorUiRefresh();
    }, 750);
  };

  // Only responsibility now to update save status
  collaboration.ydoc.on("update", updateSavedStatus);

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
