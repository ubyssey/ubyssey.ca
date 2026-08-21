// Entrypoint

import { ACTIVE_SUGGESTION_THREAD_META } from "../core/richtext/plugins.js";
import { appendStreamDocumentsToFormData, snapshotStreamDocuments } from "../core/prosemirror/persistence.js";
import { mountShortcutDocumentation } from "../core/richtext/shortcut_help.jsx";
import { createManuscriptToolbar } from "./chrome/toolbar.jsx";
import { mountManuscriptChrome } from "./chrome/mount.jsx";
import { setupCommentSidebar, setupFootnoteSidebar } from "../core/richtext/annotations/index.js";
import { blockTypeLabel, createBlockEditor, createEmptyBlock, createStreamBlockDraft, createStreamEditor } from "./stream/index.jsx";
import { createPagePreview, setupPageShadow } from "../core/preview/index.jsx";
import { pageEditorState } from "../core/state.js";
import { setupPageCollaboration } from "../core/collaboration/page.js";
import { setupPresence } from "../core/collaboration/presence.js"
import { seedMetadata } from "./metadata/collaboration.js";

function readJsonScript(id) {
  return JSON.parse(document.getElementById(id).textContent) || {};
}

document.addEventListener("DOMContentLoaded", async () => {
  const pageRoot = setupPageShadow();
  const shortcutGuide = document.getElementById("guide-container");
  if (shortcutGuide) mountShortcutDocumentation(shortcutGuide);
  const streamEditors = readJsonScript("stream-editors");
  const editorErrors = readJsonScript("editor-errors");
  const form = document.querySelector("[data-page-form]");
  const currentEditor = readJsonScript("current-editor");

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const pageId = form.dataset.pageId;
  const collaboration = await setupPageCollaboration({
    createEmptyBlock,
    currentEditor,
    initializationUrl: "/stove/page/" + pageId + "/collaboration",
    initializeSharedData: (ydoc) => ({ metadata: seedMetadata(ydoc, form) }),
    streamEditors,
    websocketUrl: protocol + "//" + window.location.host + "/ws/stove/manuscript/" + pageId,
  });

  pageEditorState.awareness = collaboration.awareness;
  pageEditorState.footnoteTexts = collaboration.ydoc.getMap("footnoteTexts");

  if (Object.keys(editorErrors).length) {
    alert("Failed to save due to errors: " + JSON.stringify(editorErrors));
  }

  // Initialized before stream editors, so we can update during setup
  pageEditorState.commentSidebar = setupCommentSidebar(document.querySelector("[data-comment-sidebar]"), {
    getViews: () => pageEditorState.currentPageTextViews(),
    getThreads: () => [],
  });
  pageEditorState.footnoteSidebar = setupFootnoteSidebar(document.querySelector("[data-footnote-sidebar]"), {
    getViews: () => pageEditorState.currentPageTextViews(),
    footnoteTexts: pageEditorState.footnoteTexts,
  });

  // 100ms debouncwd refresh for toolbar/comments/footnotes, todo convert to proper YJS callbacks
  let editorUiRefreshTimer = null;
  pageEditorState.scheduleEditorUiRefresh = () => {
    clearTimeout(editorUiRefreshTimer);
    editorUiRefreshTimer = window.setTimeout(() => {
      editorUiRefreshTimer = null;
      pageEditorState.richTextToolbar?.update();
      pageEditorState.commentSidebar?.update();
      pageEditorState.footnoteSidebar?.update();
    }, 100);
  };

  const preview = createPagePreview({
    form,
    pageRoot,
    blockTypeLabel,
    createBlockEditor,
    createStreamBlockDraft,
  });
  
  for (const [fieldName, streamEditor] of Object.entries(streamEditors)) {
    pageEditorState.registerStreamEditor(createStreamEditor(
      fieldName,
      streamEditor,
      {
        fragment: collaboration.ydoc.getXmlFragment(fieldName),
        onChange: (change) => preview.applyStreamChange(change),
        onTransaction: ({ transaction }) => {
          const activeSuggestionThreadId = transaction.getMeta(ACTIVE_SUGGESTION_THREAD_META);
          if (activeSuggestionThreadId) pageEditorState.commentSidebar?.activateThread(activeSuggestionThreadId);
        },
      },
    ));
  }

  form.addEventListener("formdata", (event) => {
    appendStreamDocumentsToFormData(event.formData, snapshotStreamDocuments(pageEditorState.streamEditors));
  });

  pageEditorState.richTextToolbar = createManuscriptToolbar(pageRoot.querySelector(".pm-page-toolbar"), {
    publishSource: document.querySelector("[data-article-toolbar-source]"),
    getContentDoc: () => pageEditorState.streamEditors.find((instance) => instance.fieldName === "content")?.doc,
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || pageEditorState.blockEditorModalOpen || event.altKey || (!event.ctrlKey && !event.metaKey)) return;
    if (event.target.closest?.("input, textarea, [contenteditable], .ProseMirror")) return;

    const key = event.key.toLowerCase();
    const action = key === "z" ? (event.shiftKey ? "redo" : "undo") : key === "y" && event.ctrlKey && !event.shiftKey ? "redo" : null;
    if (!action || !pageEditorState.richTextToolbar.runHistory(action)) return;

    event.preventDefault();
  });

  preview.mount();
  pageEditorState.richTextToolbar.update();
  pageEditorState.commentSidebar.update();
  pageEditorState.footnoteSidebar.update();

  pageEditorState.users = setupPresence(
    document.querySelector("[data-connected-users]"),
    currentEditor,
    collaboration.awareness,
    { findBlock: preview.findBlock },
  );


  // Saved Status Indicator
  const savedStatus = document.querySelector("[data-page-saved]");

  const formatSavedAt = (date) => date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  // Updates to Saving... when local doc changes
  const updateSavingStatus = () => {
    if (!savedStatus) return;
    savedStatus.textContent = "Saving...";
    pageEditorState.scheduleEditorUiRefresh();
  };

  // Updates to Saved: Date when receives ack from server that it merged
  const updateSavedStatus = () => {
    if (!savedStatus) return;
    const savedAt = new Date();
    savedStatus.dataset.lastSavedAt = savedAt.toISOString();
    savedStatus.textContent = "Saved: " + formatSavedAt(savedAt);
    pageEditorState.scheduleEditorUiRefresh();
  };

  collaboration.ydoc.on("update", updateSavingStatus);
  collaboration.provider?.on("persistence-ack", updateSavedStatus);

  preview.setupHistory();
  
  mountManuscriptChrome({
    form,
    metadata: collaboration.metadata,
    mediaUpdates: collaboration.ydoc.getMap("articleMediaUpdates"),
    schedulePreview: (options) => preview.refreshDoc(options),
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
