
export const ARTICLE_BLOCK_SELECTOR = "[data-article-block][data-stream-field]";
export const DIRECT_EDITABLE_SELECTOR = "[data-article-editable-page-field], [data-article-editable-featured-media-field], [data-article-editable-stream-field][data-article-editable-path]";
export const METADATA_FIELD_APPLIED_EVENT = "manuscript:metadata-field-applied";
export const EMPTY_RICH_TEXT = [{ type: "paragraph" }];
export const LAST_PREVIEW_HTML = new WeakMap();

// Debounce is a delay to avoid sending tons of updates when user typing quickly
export const MODAL_PREVIEW_DEBOUNCE_MS = 250;

// Transaction originated from the backing stream editor.
export const STREAM_EDITOR_META = "streamEditor";
// Transaction originated from an inline preview editor.
export const INLINE_EDITOR_META = "inlineEditor";
