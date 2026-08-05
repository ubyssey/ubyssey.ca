// Constants reused across metadata code
//todo find and replace
export const AUTHORS_KEY = "articleAuthors";
export const FIELD_PREFIX = "field:";
export const AUTHORS_CHANGED_EVENT = "manuscript:authors-changed";
export const AUTHORS_UPDATED_EVENT = "manuscript:authors-updated";
export const FIELD_APPLIED_EVENT = "manuscript:metadata-field-applied";
export const FIELD_SELECTOR = "[data-collaborative-metadata] [name]";
// This is every text input type I think, though we'll probably never use most of them
export const TEXT_INPUT_TYPES = new Set(["", "email", "search", "tel", "text", "url"]);
