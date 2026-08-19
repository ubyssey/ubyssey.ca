// Comment Model including Prosemirror Spec, UI is in comments.jsx

import { v4 as uuidv4 } from "uuid";

export function commentSuggestion(comments) {
  return comments?.[0]?.suggestion || null;
}

export const suggestionLabel = (suggestion) => suggestion.charAt(0).toUpperCase() + suggestion.slice(1).toLowerCase();

export function createSuggestionMark(commentMark, suggestion, text, threadId = uuidv4(), suggestionPart = null) {
  const username = document.querySelector("[data-current-editor-username]")?.dataset.currentEditorUsername || "";
  return commentMark.create({
    threadId,
    comments: [{
      username,
      suggestion,
      text,
      createdAt: new Date().toISOString(),
    }],
    suggestionPart,
    pending: false,
    resolved: false,
  });
}

export const commentMarkSpec = {
  attrs: {
    threadId: { default: null },
    comments: { default: [] },
    suggestionPart: { default: null },
    pending: { default: false },
    resolved: { default: false },
  },
  parseDOM: [
    { tag: "mark[data-comment-thread-id]", getAttrs: readCommentAttrs },
    { tag: "span[data-comment-thread-id]", getAttrs: readCommentAttrs },
    {
      style: "text-decoration",
      getAttrs: (value) => String(value).includes("comment") ? null : false,
    },
  ],
  toDOM(mark) {
    const attrs = mark.attrs;
    return ["span", {
      "data-comment-thread-id": attrs.threadId || "",
      "data-comment-comments": JSON.stringify(attrs.comments || []),
      "data-comment-pending": attrs.pending ? "true" : "false",
      "data-comment-resolved": attrs.resolved ? "true" : "false",
      "data-comment-suggestion": attrs.suggestionPart || commentSuggestion(attrs.comments) || "",
      "data-comment-suggestion-part": attrs.suggestionPart || "",
    }, 0];
  },
};

function readCommentAttrs(dom) {
  return {
    threadId: dom.getAttribute("data-comment-thread-id"),
    comments: parseCommentPayload(dom.getAttribute("data-comment-comments")),
    suggestionPart: dom.getAttribute("data-comment-suggestion-part") || null,
    pending: dom.getAttribute("data-comment-pending") === "true",
    resolved: dom.getAttribute("data-comment-resolved") === "true",
  };
}

function parseCommentPayload(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

export function startCommentCommand(commentMark) {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) return false;
    if (!dispatch) return true;

    const threadId = uuidv4();
    dispatch(state.tr
      .removeMark(from, to, commentMark)
      .addMark(from, to, commentMark.create({ threadId, comments: [], pending: true, resolved: false }))
      .scrollIntoView());
    return true;
  };
}

export function startCommentOnSelection(view) {
  return startCommentCommand(view.state.schema.marks.comment)(view.state, view.dispatch, view);
}

export function collectCommentThreads(view) {
  const commentMark = view.state.schema.marks.comment;
  if (!commentMark) return [];

  const threads = new Map();
  view.state.doc.descendants((node) => {
    if (!node.isText) return true;
    const mark = commentMark.isInSet(node.marks);
    if (!mark || !mark.attrs.threadId || threads.has(mark.attrs.threadId)) return true;

    threads.set(mark.attrs.threadId, {
      threadId: mark.attrs.threadId,
      comments: Array.isArray(mark.attrs.comments) ? mark.attrs.comments : [],
      pending: Boolean(mark.attrs.pending),
      resolved: Boolean(mark.attrs.resolved),
      view,
    });
    return true;
  });

  return Array.from(threads.values());
}

export function appendCommentToThread(view, threadId, comment) {
  const thread = findCommentThread(view, threadId);
  if (!thread) return false;

  return replaceCommentThread(view, thread, {
    comments: [...thread.comments, comment],
    pending: false,
    resolved: false,
  });
}

export function setCommentThreadResolved(view, threadId, resolved) {
  const thread = findCommentThread(view, threadId);
  if (!thread) return false;
  return replaceCommentThread(view, thread, { resolved: Boolean(resolved) });
}

export function acceptCommentSuggestion(view, threadId, suggestion) {
  if (suggestion === "add") return removeCommentThread(view, threadId);

  const thread = findCommentThread(view, threadId);
  if (!thread) return false;

  let tr = view.state.tr;
  for (const range of [...thread.ranges].reverse()) {
    tr = suggestion === "delete" || range.suggestionPart === "delete"
      ? tr.delete(range.from, range.to)
      : tr.removeMark(range.from, range.to, thread.commentMark);
  }
  view.dispatch(tr.scrollIntoView());
  return true;
}

export function findCommentThread(view, threadId) {
  const commentMark = view.state.schema.marks.comment;
  if (!commentMark || !threadId) return null;

  const thread = {
    commentMark,
    threadId,
    ranges: [],
    comments: [],
    pending: false,
    resolved: false,
  };

  view.state.doc.descendants((node, pos) => {
    if (!node.isText) return true;
    const mark = commentMark.isInSet(node.marks);
    if (!mark || mark.attrs.threadId !== threadId) return true;

    thread.ranges.push({
      from: pos,
      to: pos + node.nodeSize,
      suggestionPart: mark.attrs.suggestionPart,
    });
    thread.comments = Array.isArray(mark.attrs.comments) ? mark.attrs.comments : [];
    thread.pending = Boolean(mark.attrs.pending);
    thread.resolved = Boolean(mark.attrs.resolved);
    return true;
  });

  return thread.ranges.length ? thread : null;
}

export function replaceCommentThread(view, thread, attrs) {
  let tr = view.state.tr;
  const nextAttrs = {
    threadId: thread.threadId,
    comments: thread.comments,
    pending: thread.pending,
    resolved: thread.resolved,
    ...attrs,
  };

  for (const range of thread.ranges) {
    tr = tr
      .removeMark(range.from, range.to, thread.commentMark)
      .addMark(range.from, range.to, thread.commentMark.create({
        ...nextAttrs,
        suggestionPart: range.suggestionPart,
      }));
  }
  view.dispatch(tr);
  return true;
}

export function removeCommentThread(view, threadId) {
  const thread = findCommentThread(view, threadId);
  if (!thread) return false;

  let tr = view.state.tr;
  for (const range of thread.ranges) tr = tr.removeMark(range.from, range.to, thread.commentMark);
  view.dispatch(tr);
  return true;
}
