import { setupPageShadow } from "../core/preview/index.jsx";
import { setupPageCollaboration } from "../core/collaboration/page.js";
import { setupPresence } from "../core/collaboration/presence.js";
import { setupRevisionHistory } from "../core/revisions/revision_history.js";
import { fetchPreviewHtml } from "../core/preview/requests.js";
import { replacePagePreviewHtml } from "../core/preview/dom.js";
import { setupPageSaveStatus } from "../core/collaboration/save_status.js";
import { createStreamEditor, createStreamBlockDraft, createBlockEditor, createEmptyBlock, blockTypeLabel } from "../manuscript_editor/stream/index.jsx";
import { createPagePreview } from "../core/preview/index.jsx";
import { pageEditorState } from "../core/state.js";
import { createPageHistory } from "../core/collaboration/history.js";
import { createBlockToolbar } from "../manuscript_editor/chrome/toolbar.jsx";

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
    websocketUrl: protocol + "//" + window.location.host + "/ws/stove/manuscript/" + pageId,
  });

  pageEditorState.awareness = collaboration.awareness;
  pageEditorState.history = createPageHistory(collaboration.ydoc, Object.keys(streamEditors));
  const preview = createPagePreview({ form, pageRoot, blockTypeLabel, createBlockEditor, createStreamBlockDraft });
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
    { findBlock: preview.findBlock },
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

  pageEditorState.richTextToolbar = createBlockToolbar(pageRoot.querySelector(".pm-page-toolbar"), { history: pageEditorState.history });
  preview.mount();
  pageEditorState.richTextToolbar.update();
});
