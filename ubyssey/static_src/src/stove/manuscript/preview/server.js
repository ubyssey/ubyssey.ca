// Schedules preview refreshes and handles resulting html updates from server

// Richtext is a bit unique in that it doesn't have to be refreshed at the block level
// Instead we can just replace the text content directly

import { findArticleBlock } from "../blocks/controller.jsx";
import { manuscriptSession } from "../session.js";
import { currentStreamDocs, writeStreamTextareas } from "./persistence.js";
import { METADATA_FIELD_APPLIED_EVENT, MODAL_PREVIEW_DEBOUNCE_MS } from "./constants.js";
import { syncDirectPageEditorsFromMetadata } from "./editors.jsx";
import { focusedArticleBlock, replaceArticlePreviewHtml, replaceSelectedBlockPreviewHtml, replaceUnfocusedArticleBlocks, restoreCurrentArticleControls } from "./html.js";
import { fetchPreviewHtml } from "./requests.js";

// Handles preview refreshes
export function setupServerPreviewRefresh(form, manuscriptRoot) {
  if (!form?.dataset.previewUrl || !manuscriptRoot) return;

  let timer = null;
  let timerDelay = null;
  let controller = null;
  let previewId = 0;
  let previewRevision = 0;
  let deferredManuscriptPreview = false;
  let scheduledPreviewBlock = null;
  let scheduledPreserveFocusedBlock = false;
  const historySelect = document.querySelector("[data-history-select]");

  manuscriptSession.schedulePreview = ({ deferIfManuscriptFocused = false, immediate = false, debounceMs = null, blockOnly = false } = {}) => {
    const delay = debounceMs ?? (immediate ? 0 : 500);
    if (timer && timerDelay === 0 && delay > 0) return;

    if (historySelect) historySelect.selectedIndex = 0;
    previewRevision += 1;
    clearTimeout(timer);
    scheduledPreviewBlock = blockOnly && manuscriptSession.selectedArticleBlock
      ? { ...manuscriptSession.selectedArticleBlock }
      : null;

    const deferForFocus = deferIfManuscriptFocused && focusedArticleRichText(manuscriptRoot);
    scheduledPreserveFocusedBlock = Boolean(deferForFocus && focusedArticleBlock(manuscriptRoot));
    if (deferForFocus) {
      deferredManuscriptPreview = true;
      if (!scheduledPreserveFocusedBlock) return;
    } else {
      deferredManuscriptPreview = false;
    }

    timerDelay = delay;
    timer = setTimeout(sendPreview, delay);
  };

  manuscriptSession.cancelPreviewRefresh = () => {
    previewRevision += 1;
    clearTimeout(timer);
    controller?.abort();
    timer = null;
    timerDelay = null;
    deferredManuscriptPreview = false;
    scheduledPreviewBlock = null;
    scheduledPreserveFocusedBlock = false;
  };

  const flushDeferredPreview = () => {
    if (manuscriptSession.blockEditorModalOpen) return;
    if (!deferredManuscriptPreview || focusedArticleRichText(manuscriptRoot)) return;
    manuscriptSession.schedulePreview();
  };

  const scheduleFromForm = (event) => {
    if ((event.composedPath?.() || []).some((element) => element?.matches?.("[data-history-select], .manuscript-topbar, .manuscript-topbar *"))) return;
    if ((event.composedPath?.() || []).some((element) => element?.matches?.(".pm-manuscript-rich-text, .pm-manuscript-direct-edit, .pm-comment-reply"))) return;
    manuscriptSession.schedulePreview({
      deferIfManuscriptFocused: Boolean(event.detail?.deferPreviewIfFocused),
      debounceMs: manuscriptSession.blockEditorModalOpen ? MODAL_PREVIEW_DEBOUNCE_MS : undefined,
      blockOnly: manuscriptSession.blockEditorEditing,
    });
  };

  form.addEventListener("input", scheduleFromForm);
  form.addEventListener("change", scheduleFromForm);
  form.addEventListener(METADATA_FIELD_APPLIED_EVENT, (event) => {
    syncDirectPageEditorsFromMetadata(manuscriptRoot, event);
  });
  manuscriptRoot.addEventListener("focusout", () => { setTimeout(flushDeferredPreview, 0); });
  form.addEventListener("focusout", () => { setTimeout(flushDeferredPreview, 0); });

  // Fetches HTML, and writes to textareas
  async function sendPreview() {
    timer = null;
    timerDelay = null;
    const requestedBlock = scheduledPreviewBlock;
    const preserveFocusedBlock = scheduledPreserveFocusedBlock;
    const streamDocs = currentStreamDocs();
    writeStreamTextareas(streamDocs);

    controller?.abort();
    controller = new AbortController();
    const currentPreviewId = ++previewId;
    const requestRevision = previewRevision;

    try {
      const html = await fetchPreviewHtml(form, new FormData(form), controller.signal);
      if (currentPreviewId !== previewId || requestRevision !== previewRevision || !html) return;

      if (requestedBlock) {
        replaceSelectedBlockPreviewHtml(manuscriptRoot, html, streamDocs, requestedBlock);
        return;
      }

      if (preserveFocusedBlock && replaceUnfocusedArticleBlocks(manuscriptRoot, html, streamDocs)) {
        return;
      }

      if (replaceArticlePreviewHtml(manuscriptRoot, html, {
        preservePosition: true,
        skipIfUnchanged: true,
      })) {
        const reveal = manuscriptSession.revealSelectedArticleBlock;
        restoreCurrentArticleControls(manuscriptRoot, streamDocs);
        if (reveal) {
          manuscriptSession.revealSelectedArticleBlock = null;
          window.requestAnimationFrame(() => {
            const articleBlock = findArticleBlock(manuscriptRoot, reveal);
            articleBlock?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        }
      }
    } catch (error) {
      if (error.name !== "AbortError") console.error(error);
    }
  }
}

// Defer preview refresh while richtext is focused todo maybe replace at this point
function focusedArticleRichText(manuscriptRoot) {
  const active = manuscriptRoot?.activeElement;
  const modalActive = document.activeElement?.closest?.(
    ".article-block-editor-modal .ProseMirror, .article-block-editor-modal input, .article-block-editor-modal textarea, .article-block-editor-modal select",
  );
  return Boolean(active?.closest?.(".pm-manuscript-rich-text, .pm-manuscript-direct-edit, .pm-manuscript-toolbar") || modalActive);
}
