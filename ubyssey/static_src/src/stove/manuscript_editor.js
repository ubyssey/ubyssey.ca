// Entrypoint + State

import { createEditorToolbar } from "./manuscript_prosemirror.jsx";
import { setupCommentSidebar, setupFootnoteSidebar } from "./manuscript_annotations.jsx";
import { createStreamEditor } from "./manuscript_prosetail.jsx";
import { collectBlockCommentThreads, refreshBlockCommentBorders, showSelectedArticleBlockEditor, setupArticleBlockKeyboard } from "./manuscript_blocks.jsx";
import { mountManuscriptChrome, setupArticlePreviewEditors, setupArticleShadow, setupHistoryPreviewButtons, setupServerPreviewRefresh, writeStreamTextareas } from "./manuscript_document.jsx";

export const editorState = {
  streamEditors: [],
  articleRichTextEditors: [],
  articleDirectTextEditors: [],
  articleBlockControls: null,
  richTextToolbar: null,
  commentSidebar: null,
  footnoteSidebar: null,
  selectedArticleBlock: null,
  revealSelectedArticleBlock: null,
  blockEditorModalOpen: false,
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
          if (!editorState.blockEditorModalOpen && !transaction.getMeta("skipPreview")) {
            editorState.schedulePreview({ deferIfManuscriptFocused: Boolean(transaction.getMeta("deferPreviewIfFocused")) });
          }
        },
        onTransaction: () => {
          showSelectedArticleBlockEditor(editorState.selectedArticleBlock);
          refreshBlockCommentBorders(manuscriptRoot);
          editorState.commentSidebar.update();
          editorState.footnoteSidebar.update();
        },
      },
    ));
  }

  editorState.richTextToolbar = createEditorToolbar(manuscriptRoot.querySelector(".pm-manuscript-toolbar"), {
    publishSource: document.querySelector("[data-article-toolbar-source]"),
  });

  const articleTextViews = () => {
    const manuscriptViews = [
      ...editorState.articleRichTextEditors.map((editor) => editor.view),
      ...editorState.articleDirectTextEditors.map((editor) => editor.view),
    ];
    return manuscriptViews.length ? manuscriptViews : editorState.streamEditors.map((editor) => editor.view);
  };

  editorState.commentSidebar = setupCommentSidebar(document.querySelector("[data-comment-sidebar]"), {
    getViews: articleTextViews,
    getThreads: collectBlockCommentThreads,
  });
  editorState.footnoteSidebar = setupFootnoteSidebar(document.querySelector("[data-footnote-sidebar]"), {
    getViews: articleTextViews,
  });

  setupArticlePreviewEditors(manuscriptRoot);
  editorState.commentSidebar.update();
  editorState.footnoteSidebar.update();
  setupArticleBlockKeyboard(manuscriptRoot);

  const form = document.querySelector("[data-manuscript-form]");
  setupServerPreviewRefresh(form, manuscriptRoot);
  setupHistoryPreviewButtons(manuscriptRoot);
  mountManuscriptChrome({
    form,
    schedulePreview: (...args) => editorState.schedulePreview(...args),
    writeBeforeSave: writeStreamTextareas,
  });
});
