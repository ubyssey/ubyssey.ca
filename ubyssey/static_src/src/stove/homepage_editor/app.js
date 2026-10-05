import { setupPageShadow } from "../core/preview/index.jsx";
import { setupPageCollaboration } from "../core/collaboration/page.js";
import { setupPresence } from "../core/collaboration/presence.js";
import { setupManualRevisionSave, setupRevisionHistory, setupWagtailHandoff } from "../core/revisions/revision_history.js";
import { fetchPreviewHtml } from "../core/preview/requests.js";
import { replacePagePreviewHtml } from "../core/preview/dom.js";
import { setupPageSaveStatus } from "../core/collaboration/save_status.js";
import { createStreamEditor, createStreamBlockDraft, createBlockEditor, createEmptyBlock, blockTypeLabel } from "../manuscript_editor/stream/index.jsx";
import { createPagePreview } from "../core/preview/index.jsx";
import { pageEditorState } from "../core/state.js";
import { createPageHistory } from "../core/collaboration/history.js";
import { formDataWithStreamDocuments, snapshotStreamDocuments } from "../core/prosemirror/persistence.js";

function readJsonScript(id) {
  return JSON.parse(document.getElementById(id).textContent);
}

document.addEventListener("DOMContentLoaded", async () => {
  const pageRoot = setupPageShadow();
  const form = document.querySelector("[data-page-form]");
  const currentEditor = readJsonScript("current-editor");
  const streamEditors = readJsonScript("stream-editors");
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const pageId = form.dataset.pageId;
  const collaboration = await setupPageCollaboration({
    createEmptyBlock,
    currentEditor,
    initializationUrl: "/stove/page/" + pageId + "/collaboration",
    streamEditors,
    presenceUrl: "/stove/page/" + pageId + "/collaboration/presence",
    websocketUrl: protocol + "//" + window.location.host + "/ws/stove/manuscript/" + pageId,
  });

  if (collaboration.blockedByWagtail) {
    window.location.assign(form.dataset.stoveHomeUrl || "/stove/");
    return;
  }

  pageEditorState.awareness = collaboration.awareness;
  pageEditorState.history = createPageHistory(collaboration.ydoc, Object.keys(streamEditors));
  const preview = createPagePreview({ form, pageRoot, blockTypeLabel, createBlockEditor, createStreamBlockDraft, collaboration });
  Object.entries(streamEditors).forEach(([fieldName, streamEditor]) => {
    pageEditorState.registerStreamEditor(createStreamEditor(fieldName, streamEditor, {
      fragment: collaboration.ydoc.getXmlFragment(fieldName),
      history: pageEditorState.history,
      onChange: (change) => preview.applyStreamChange(change),
    }));
  });

  setupPageSaveStatus(collaboration);

  pageEditorState.users = setupPresence(
    document.querySelector("[data-connected-users]"),
    currentEditor,
    collaboration.awareness,
    { findBlock: preview.findBlock, homeUrl: "/stove/" },
  );

  setupRevisionHistory(form, {
    formDataBeforeRestore: () => new FormData(form),
    onHistoryModeChange: (active) => form.classList.toggle("page-editor--history", active),
    async onPreviewRevision(revisionId, isCurrent) {
      const formData = new FormData(form);
      if (!isCurrent) formData.set("revision", revisionId);
      const html = await fetchPreviewHtml(form.dataset.previewUrl, formData);
      if (html) replacePagePreviewHtml(pageRoot, html);
    },
  });

  setupManualRevisionSave(form, {
    formDataForSave: () => formDataWithStreamDocuments(form, snapshotStreamDocuments(pageEditorState.streamEditors)),
  });

  setupWagtailHandoff(form, {
    formDataForSave: () => formDataWithStreamDocuments(form, snapshotStreamDocuments(pageEditorState.streamEditors)),
    beforeSave: () => {
      pageEditorState.users.kickOtherUsers();
      return pageEditorState.users.waitForOtherUsersToLeave();
    },
  });

  preview.mount();
});
