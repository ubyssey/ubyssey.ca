// Entrypoint

import { ACTIVE_SUGGESTION_THREAD_META } from "./rich_text/index.jsx";
import { createEditorToolbar } from "./rich_text/toolbar.jsx";
import { setupCommentSidebar, setupFootnoteSidebar } from "./annotations/index.js";
import { createStreamEditor } from "./stream/index.jsx";
import { collectBlockCommentThreads, refreshBlockCommentBorders, syncSelectedArticleBlockEditor, setupArticleBlockKeyboard } from "./blocks/controller.jsx";
import { currentStreamDocs, mountManuscriptChrome, setupArticlePreviewEditors, setupArticleShadow, setupHistoryPreviewButtons, setupServerPreviewRefresh, syncArticlePreviewEditors, writeStreamTextareas } from "./preview/index.jsx";
import { manuscriptSession } from "./session.js";
import { setupUsers } from "./socket/users.js";

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
    manuscriptSession.registerStreamEditor(createStreamEditor(
      textarea,
      streamEditors[textarea.dataset.streamField] || {},
      {
        onDocChanged: ({ transaction }) => {
          if (!manuscriptSession.blockEditorModalOpen && !transaction.getMeta("skipPreview")) {
            manuscriptSession.schedulePreview({ deferIfManuscriptFocused: Boolean(transaction.getMeta("deferPreviewIfFocused")) });
          }
        },
        onTransaction: ({ transaction, instance }) => {
          syncArticlePreviewEditors({ transaction, instance });
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

  const form = document.querySelector("[data-manuscript-form]");
  manuscriptSession.users = setupUsers(
    form.dataset.manuscriptPageId,
    document.querySelector("[data-connected-users]"),
    readJsonScript("current-editor"),
  );

  setupServerPreviewRefresh(form, manuscriptRoot);
  setupHistoryPreviewButtons(manuscriptRoot);
  mountManuscriptChrome({
    form,
    schedulePreview: (...args) => manuscriptSession.schedulePreview(...args),
    writeBeforeSave: writeStreamTextareas,
  });
});
