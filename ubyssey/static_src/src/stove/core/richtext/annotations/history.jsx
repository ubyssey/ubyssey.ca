import { pageEditorState } from "../../state.js";
import { readCommentAttrs, readSuggestionAttrs } from "./comment_model.js";
import { readFootnoteAttrs } from "./footnotes.jsx";

// Reads annotations from html (because history uses old revisions)
export function showHistoryAnnotations(pageRoot) {
  const threads = new Map();
  const footnotes = new Map();

  pageRoot.querySelectorAll("[data-comment-thread-id], [data-suggestion-thread-id], [data-footnote-id]").forEach((mark) => {
    if (mark.hasAttribute("data-comment-thread-id")) {
      const attrs = readCommentAttrs(mark);
      if (!attrs.threadId || !attrs.comments.length || attrs.pending) return;
      const key = `comment:${attrs.threadId}`;
      if (!threads.has(key)) threads.set(key, { kind: "comment", ...attrs });
    }

    if (mark.hasAttribute("data-suggestion-thread-id")) {
      const attrs = readSuggestionAttrs(mark);
      if (!attrs.threadId || !attrs.comments.length || attrs.pending) return;
      const key = `suggestion:${attrs.threadId}`;
      if (!threads.has(key)) threads.set(key, { kind: "suggestion", ...attrs });
    }

    if (mark.hasAttribute("data-footnote-id")) {
      const { footnoteId, text } = readFootnoteAttrs(mark);
      if (footnoteId && !footnotes.has(footnoteId)) footnotes.set(footnoteId, { footnoteId, text });
    }
  });

  pageEditorState.commentSidebar?.setHistoryThreads([...threads.values()]);
  pageEditorState.footnoteSidebar?.setHistoryFootnotes([...footnotes.values()]);
}
