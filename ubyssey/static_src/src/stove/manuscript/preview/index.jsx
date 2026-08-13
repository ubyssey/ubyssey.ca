
// Old Description: Now split up into multiple files, this just exports the relevant functions
// Handles server rendered previews
// Creates RichText editors directly over preview elements
// Merges edits within preview to form inputs/stream docs
// Previewing Historical Revisions as well

export { mountManuscriptChrome } from "../chrome/index.jsx";
export { setupArticleShadow } from "./shadow_root.js";
export { currentStreamDocs, writeStreamTextarea, writeStreamTextareas } from "./persistence.js";
export { MODAL_PREVIEW_DEBOUNCE_MS } from "./constants.js";
export { refreshPlainTextEditorsFromStream, setupArticlePreviewEditors } from "./editors.jsx";
export { setupHistoryPreviewButtons } from "./history.js";
export { reconcilePreviewBlocks } from "./reconciliation.js";
export { setupServerPreviewRefresh } from "./server.js";
