// Schedules preview refreshes and handles resulting html updates from server
// Richtext is a bit unique in that it doesn't have to be refreshed at the block level
// Instead we can just replace the text content directly
import { findPageBlock, syncSelectedPageBlockEditor } from "./selection.js";

import { pageEditorState } from "../state.js";
import { formDataWithStreamDocuments, snapshotStreamDocuments } from "../prosemirror/persistence.js";
import { syncPageEditorsFromMetadata } from "./editables.jsx";
import { setupRevisionHistory } from "../revisions/revision_history.js";
import { focusedPageBlock, replacePagePreviewHtml, replaceSelectedBlockPreviewHtml, replaceUnfocusedPageBlocks, restoreCurrentPageControls } from "./dom.js";
import { fetchPreviewHtml } from "./requests.js";

// Handles preview refreshes
export const MODAL_PREVIEW_DEBOUNCE_MS = 250;
export const PAGE_FIELD_APPLIED_EVENT = "page:metadata-field-applied";

// Contains a bunch of hacky refresh stuff left over from before migration to full YJS, should look into removing stuff that doesn't matter anymore
export function createPreviewRefresh(form, pageRoot) {
  if (!form?.dataset.previewUrl || !pageRoot) return;

  let timer = null;
  let timerDelay = null;
  let previewId = 0;
  let previewRevision = 0;
  let deferredPagePreview = false;
  let scheduledPreviewBlock = null;
  let scheduledPreserveFocusedBlock = false;
  const historySelect = document.querySelector("[data-history-select]");

  const schedulePreview = ({ deferIfPageFocused = false, immediate = false, debounceMs = null, blockOnly = false, block = null } = {}) => {
    const delay = debounceMs ?? (immediate ? 0 : 500);
    if (timer && timerDelay === 0 && delay > 0) return;

    if (historySelect) historySelect.selectedIndex = 0;
    previewRevision += 1;
    clearTimeout(timer);
    scheduledPreviewBlock = block || (blockOnly && pageEditorState.selectedBlock ? { ...pageEditorState.selectedBlock } : null);

    const deferForFocus = deferIfPageFocused && focusedPageRichText(pageRoot);
    scheduledPreserveFocusedBlock = Boolean(deferForFocus && focusedPageBlock(pageRoot));
    if (deferForFocus) {
      deferredPagePreview = true;
      if (!scheduledPreserveFocusedBlock) return;
    } else {
      deferredPagePreview = false;
    }

    timerDelay = delay;
    timer = setTimeout(sendPreview, delay);
  };

  const cancelPreview = () => {
    previewRevision += 1;
    clearTimeout(timer);
    timer = null;
    timerDelay = null;
    deferredPagePreview = false;
    scheduledPreviewBlock = null;
    scheduledPreserveFocusedBlock = false;
  };

  const refresh = {
    refreshDoc(options = {}) {
      schedulePreview(options);
    },
    // The preview endpoint renders one page document, so a stream refresh uses
    // the document request while keeping the call site explicit about scope.
    refreshStream(_fieldName, options = {}) {
      schedulePreview(options);
    },
    refreshBlock(block, options = {}) {
      schedulePreview({ ...options, block });
    },
    cancel() {
      cancelPreview();
    },
    destroy() {
      cancelPreview();
      form.removeEventListener("input", scheduleFromForm);
      form.removeEventListener("change", scheduleFromForm);
      form.removeEventListener(PAGE_FIELD_APPLIED_EVENT, applyMetadataChange);
      pageRoot.removeEventListener("focusout", scheduleAfterPageFocus);
      form.removeEventListener("focusout", scheduleAfterPageFocus);
    },
  };

  const flushDeferredPreview = () => {
    if (pageEditorState.blockEditorModalOpen) return;
    if (!deferredPagePreview || focusedPageRichText(pageRoot)) return;
    schedulePreview();
  };

  const scheduleFromForm = (event) => {
    if ((event.composedPath?.() || []).some((element) => element?.matches?.("[data-history-select], .page-editor-topbar, .page-editor-topbar *"))) return;
    if ((event.composedPath?.() || []).some((element) => element?.matches?.(".pm-page-rich-text, .pm-page-direct-edit, .pm-comment-reply"))) return;
    schedulePreview({
      deferIfPageFocused: Boolean(event.detail?.deferPreviewIfFocused),
      debounceMs: pageEditorState.blockEditorModalOpen ? MODAL_PREVIEW_DEBOUNCE_MS : undefined,
      blockOnly: pageEditorState.blockEditorEditing,
    });
  };

  const applyMetadataChange = (event) => syncPageEditorsFromMetadata(pageRoot, event);
  const scheduleAfterPageFocus = () => setTimeout(flushDeferredPreview, 0);

  form.addEventListener("input", scheduleFromForm);
  form.addEventListener("change", scheduleFromForm);
  form.addEventListener(PAGE_FIELD_APPLIED_EVENT, applyMetadataChange);
  pageRoot.addEventListener("focusout", scheduleAfterPageFocus);
  form.addEventListener("focusout", scheduleAfterPageFocus);

  // Fetches HTML with the current stream snapshots
  async function sendPreview() {
    timer = null;
    timerDelay = null;
    const requestedBlock = scheduledPreviewBlock;
    const preserveFocusedBlock = scheduledPreserveFocusedBlock;
    const streamDocs = snapshotStreamDocuments(pageEditorState.streamEditors);
    const formData = formDataWithStreamDocuments(form, streamDocs);

    const currentPreviewId = ++previewId;
    const requestRevision = previewRevision;

    try {
      const html = await fetchPreviewHtml(form.dataset.previewUrl, formData);
      if (currentPreviewId !== previewId || requestRevision !== previewRevision || !html) return;

      if (requestedBlock) {
        replaceSelectedBlockPreviewHtml(pageRoot, html, streamDocs, requestedBlock);
        return;
      }

      if (preserveFocusedBlock && replaceUnfocusedPageBlocks(pageRoot, html, streamDocs)) {
        return;
      }

      if (replacePagePreviewHtml(pageRoot, html, {
        preservePosition: true,
        skipIfUnchanged: true,
      })) {
        const reveal = pageEditorState.revealSelectedBlock;
        restoreCurrentPageControls(pageRoot, streamDocs);
        if (reveal) {
          pageEditorState.revealSelectedBlock = null;
          window.requestAnimationFrame(() => {
            const pageBlock = findPageBlock(pageRoot, reveal);
            pageBlock?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        }
      }
    } catch (error) {
      if (error.name !== "AbortError") console.error(error);
    }
  }
  return refresh;
}

// Defer preview refresh while richtext is focused todo maybe replace at this point
function focusedPageRichText(pageRoot) {
  const active = pageRoot?.activeElement;
  const modalActive = document.activeElement?.closest?.(
    ".page-block-editor-modal .ProseMirror, .page-block-editor-modal input, .page-block-editor-modal textarea, .page-block-editor-modal select",
  );
  return Boolean(active?.closest?.(".pm-page-rich-text, .pm-page-direct-edit, .pm-page-toolbar") || modalActive);
}

// Revision Preview setup
export function setupHistoryPreviewButtons(pageRoot, cancelPreview) {
  const form = document.querySelector("[data-page-form]");
  if (!form || !pageRoot) return;
  let historyPreviewId = 0;

  setupRevisionHistory(form, {
    formDataBeforeRestore: () => formDataWithStreamDocuments(form, snapshotStreamDocuments(pageEditorState.streamEditors)),
    onHistoryModeChange: (active) => form.classList.toggle("page-editor--history", active),
    async onPreviewRevision(revisionId, isCurrent) {
      const currentPreviewId = ++historyPreviewId;
      try {
        cancelPreview();
        const streamDocs = isCurrent ? snapshotStreamDocuments(pageEditorState.streamEditors) : null;
        const formData = isCurrent ? formDataWithStreamDocuments(form, streamDocs) : new FormData(form);

        if (!isCurrent) formData.set("revision", revisionId);

        const html = await fetchPreviewHtml(form.dataset.previewUrl, formData);
        if (currentPreviewId !== historyPreviewId || !html || !replacePagePreviewHtml(pageRoot, html)) return;

        if (isCurrent) {
          restoreCurrentPageControls(pageRoot, streamDocs);
        } else {
          pageEditorState.selectedBlock = null;
          syncSelectedPageBlockEditor(null);
        }
      } catch (error) {
        if (error.name !== "AbortError") console.error(error);
      }
    },
  });
}
