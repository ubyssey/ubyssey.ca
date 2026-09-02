import { setupPageShadow } from "../core/preview/index.jsx";
import { setupPageCollaboration } from "../core/collaboration/page.js";
import { setupPresence } from "../core/collaboration/presence.js";
import { setupRevisionHistory } from "../core/revisions/revision_history.js";
import { fetchPreviewHtml } from "../core/preview/requests.js";
import { replacePagePreviewHtml } from "../core/preview/dom.js";
import { setupPageSaveStatus } from "../core/collaboration/save_status.js";

function readJsonScript(id) {
  return JSON.parse(document.getElementById(id).textContent);
}

document.addEventListener("DOMContentLoaded", async () => {
  const pageRoot = setupPageShadow();
  const form = document.querySelector("[data-page-form]");
  const currentEditor = readJsonScript("current-editor");
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const pageId = form.dataset.pageId;
  const collaboration = await setupPageCollaboration({
    createEmptyBlock: () => null,
    currentEditor,
    initializationUrl: "/stove/page/" + pageId + "/collaboration",
    streamEditors: {},
    websocketUrl: protocol + "//" + window.location.host + "/ws/stove/manuscript/" + pageId,
  });

  setupPageSaveStatus(collaboration);

  setupPresence(
    document.querySelector("[data-connected-users]"),
    currentEditor,
    collaboration.awareness,
    { findBlock: () => null },
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
});
