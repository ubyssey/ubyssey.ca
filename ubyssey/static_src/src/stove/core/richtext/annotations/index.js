export { setupCommentSidebar } from "./comments.jsx";
export {
  commentMarkSpec,
  suggestionMarkSpec,
  commentSuggestion,
  createSuggestionMark,
  appendThreadComment,
  acceptSuggestion,
  rejectSuggestion,
  removeAnnotationThread,
  migrateLegacySuggestionMarksInDoc,
  startCommentCommand,
  startCommentOnSelection,
  TEXT_SELECTION_COMMENT_BUBBLE_HIDE_META,
} from "./comment_model.js";
export {
  footnoteMarkSpec,
  setupFootnoteSidebar,
  startFootnoteCommand,
} from "./footnotes.jsx";
export { markRangeAtCursor } from "../marks.js";
