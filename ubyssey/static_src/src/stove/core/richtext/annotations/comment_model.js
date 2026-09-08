// Comment Model including Prosemirror Spec, UI is in comments.jsx

import { v4 as uuidv4 } from "uuid";

export function commentSuggestion(comments) {
  return comments?.[0]?.suggestion || null;
}

export const suggestionLabel = (suggestion) => suggestion.charAt(0).toUpperCase() + suggestion.slice(1).toLowerCase();

export function createSuggestionMark(suggestionMark, suggestion, text, threadId = uuidv4(), suggestionPart = null) {
  const username = document.querySelector("[data-current-editor-username]")?.dataset.currentEditorUsername || "";
  return suggestionMark.create({
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
  inclusive: false,
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

// Separate from comment so both can exist at once on the same piece of text
export const suggestionMarkSpec = {
  inclusive: false,
  attrs: {
    threadId: { default: null },
    comments: { default: [] },
    suggestionPart: { default: null },
    pending: { default: false },
    resolved: { default: false },
  },
  parseDOM: [
    { tag: "mark[data-suggestion-thread-id]", getAttrs: readSuggestionAttrs },
    { tag: "span[data-suggestion-thread-id]", getAttrs: readSuggestionAttrs },
  ],
  toDOM(mark) {
    const attrs = mark.attrs;
    return ["span", {
      "data-suggestion-thread-id": attrs.threadId || "",
      "data-suggestion-comments": JSON.stringify(attrs.comments || []),
      "data-suggestion-pending": attrs.pending ? "true" : "false",
      "data-suggestion-resolved": attrs.resolved ? "true" : "false",
      "data-suggestion-part": attrs.suggestionPart || commentSuggestion(attrs.comments) || "",
    }, 0];
  },
};

function readSuggestionAttrs(dom) {
  return {
    threadId: dom.getAttribute("data-suggestion-thread-id"),
    comments: parseCommentPayload(dom.getAttribute("data-suggestion-comments")),
    suggestionPart: dom.getAttribute("data-suggestion-part") || null,
    pending: dom.getAttribute("data-suggestion-pending") === "true",
    resolved: dom.getAttribute("data-suggestion-resolved") === "true",
  };
}

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

export function migrateLegacySuggestionMarks(view) {
  const commentMark = view.state.schema.marks.comment;
  const suggestionMark = view.state.schema.marks.suggestion;

  let tr = view.state.tr;
  view.state.doc.descendants((node, position) => {
    if (!node.isText) return true;
    const mark = commentMark.isInSet(node.marks);
    if (!mark || !commentSuggestion(mark.attrs.comments)) return true;

    tr = tr
      .removeMark(position, position + node.nodeSize, commentMark)
      .addMark(position, position + node.nodeSize, suggestionMark.create(mark.attrs));
    return true;
  });

  if (!tr.docChanged) return false;
  view.dispatch(tr.setMeta("addToHistory", false));
  return true;
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
      .setMeta("skipPreview", true));
    return true;
  };
}

export function startCommentOnSelection(view) {
  return startCommentCommand(view.state.schema.marks.comment)(view.state, view.dispatch, view);
}

export function collectAnnotationThreads(views) {
  const threads = new Map();

  for (const view of views) {
    for (const kind of ["comment", "suggestion"]) {
      const markType = view.state.schema.marks[kind];
      view.state.doc.descendants((node) => {
        if (!node.isText) return true;
        const mark = markType.isInSet(node.marks);
        if (!mark?.attrs.threadId) return true;

        const key = `${kind}:${mark.attrs.threadId}`;
        const thread = threads.get(key);
        if (thread) {
          if (!thread.views.includes(view)) thread.views.push(view);
          return true;
        }

        threads.set(key, {
          kind,
          threadId: mark.attrs.threadId,
          comments: Array.isArray(mark.attrs.comments) ? mark.attrs.comments : [],
          pending: Boolean(mark.attrs.pending),
          resolved: Boolean(mark.attrs.resolved),
          view,
          views: [view],
        });
        return true;
      });
    }
  }

  return Array.from(threads.values());
}

function findAnnotationThread(view, kind, threadId) {
  const markType = view.state.schema.marks[kind];
  if (!threadId) return null;

  const thread = { markType, ranges: [], comments: [], pending: false, resolved: false };
  view.state.doc.descendants((node, position) => {
    if (!node.isText) return true;
    const mark = markType.isInSet(node.marks);
    if (!mark || mark.attrs.threadId !== threadId) return true;

    thread.ranges.push({
      from: position,
      to: position + node.nodeSize,
      suggestionPart: mark.attrs.suggestionPart,
    });
    thread.comments = Array.isArray(mark.attrs.comments) ? mark.attrs.comments : [];
    thread.pending = Boolean(mark.attrs.pending);
    thread.resolved = Boolean(mark.attrs.resolved);
    return true;
  });

  return thread.ranges.length ? thread : null;
}

function replaceAnnotationThread(thread, attrs) {
  let changed = false;

  for (const view of thread.views) {
    const fragment = findAnnotationThread(view, thread.kind, thread.threadId);
    if (!fragment) continue;

    let tr = view.state.tr;
    const nextAttrs = {
      threadId: thread.threadId,
      comments: thread.comments,
      pending: thread.pending,
      resolved: thread.resolved,
      ...attrs,
    };
    for (const range of fragment.ranges) {
      tr = tr
        .removeMark(range.from, range.to, fragment.markType)
        .addMark(range.from, range.to, fragment.markType.create({
          ...nextAttrs,
          suggestionPart: range.suggestionPart,
        }));
    }
    view.dispatch(tr.setMeta("skipPreview", true));
    changed = true;
  }

  return changed;
}

export function appendThreadComment(thread, comment) {
  return replaceAnnotationThread(thread, {
    comments: [...thread.comments, comment],
    pending: false,
    resolved: false,
  });
}

export function setCommentThreadResolved(thread, resolved) {
  return replaceAnnotationThread(thread, { resolved: Boolean(resolved) });
}

export function removeAnnotationThread(thread) {
  let changed = false;

  for (const view of thread.views) {
    const fragment = findAnnotationThread(view, thread.kind, thread.threadId);
    if (!fragment) continue;

    let tr = view.state.tr;
    for (const range of fragment.ranges) tr = tr.removeMark(range.from, range.to, fragment.markType);
    view.dispatch(tr.setMeta("skipPreview", true));
    changed = true;
  }

  return changed;
}

export function acceptSuggestion(thread, suggestion) {
  if (suggestion === "add") return removeAnnotationThread(thread);

  let changed = false;
  for (const view of thread.views) {
    const fragment = findAnnotationThread(view, "suggestion", thread.threadId);
    if (!fragment) continue;

    let tr = view.state.tr;
    for (const range of [...fragment.ranges].reverse()) {
      tr = suggestion === "delete" || range.suggestionPart === "delete"
        ? tr.delete(range.from, range.to)
        : tr.removeMark(range.from, range.to, fragment.markType);
    }
    view.dispatch(tr.scrollIntoView());
    changed = true;
  }

  return changed;
}

export function rejectSuggestion(thread, suggestion) {
  let changed = false;
  for (const view of thread.views) {
    const fragment = findAnnotationThread(view, "suggestion", thread.threadId);
    if (!fragment) continue;

    let tr = view.state.tr;
    for (const range of [...fragment.ranges].reverse()) {
      tr = suggestion === "add" || range.suggestionPart === "add"
        ? tr.delete(range.from, range.to)
        : tr.removeMark(range.from, range.to, fragment.markType);
    }
    view.dispatch(tr.scrollIntoView());
    changed = true;
  }

  return changed;
}
