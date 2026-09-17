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
} from "./comment_model.js";
export {
  footnoteMarkSpec,
  setupFootnoteSidebar,
  startFootnoteCommand,
} from "./footnotes.jsx";
export { markRangeAtCursor } from "../marks.js";
