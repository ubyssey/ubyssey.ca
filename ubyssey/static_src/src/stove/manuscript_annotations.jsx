// Handles footnotes, comments, marks

import { createRoot } from "react-dom/client";
import { v4 as uuidv4 } from "uuid";

export function setupCommentSidebar(root, { getViews, getThreads }) {
  const username = document.querySelector("[data-current-editor-username]").dataset.currentEditorUsername;
  const reactRoot = createRoot(root);
  let activeThreadId = null;
  let positionFrame = null;

  const currentThreads = () => [
    ...getViews().flatMap((view) => collectCommentThreads(view)),
    ...getThreads(),
  ];

  const setActiveThread = (threadId) => {
    activeThreadId = threadId;
    update();
  };

  const clearActiveThread = () => {
    if (!activeThreadId) return;
    activeThreadId = null;
    update();
  };

  const update = () => {
    const threads = currentThreads();
    if (activeThreadId && !threads.some((thread) => thread.threadId === activeThreadId && !thread.resolved)) activeThreadId = null;
    reactRoot.render(
      <CommentSidebar
        threads={threads}
        username={username}
        refresh={update}
        activeThreadId={activeThreadId}
        setActiveThread={setActiveThread}
      />,
    );
    scheduleCommentPositions();
    updateActiveCommentMarks(activeThreadId, threads);
  };

  const eventPath = (event) => event.composedPath?.() || [];
  const eventCommentCard = (event) => eventPath(event)
    .find((element) => element?.matches?.(".pm-comment-thread"));
  const eventCommentMark = (event) => eventPath(event)
    .find((element) => element?.matches?.("[data-comment-thread-id]"));

  const removePendingThreads = (event) => {
    const commentMark = eventCommentMark(event);
    if (eventCommentCard(event) || commentMark) return;

    clearActiveThread();
    let changed = false;
    currentThreads().forEach((thread) => {
      if (!thread.pending) return;
      changed = (thread.remove ? thread.remove() : removeCommentThread(thread.view, thread.threadId)) || changed;
    });
    if (changed) update();
  };

  const onCommentMarkClick = (event) => {
    const mark = eventCommentMark(event);
    if (mark?.dataset.commentResolved === "true") return;
    if (mark?.dataset.commentThreadId) setActiveThread(mark.dataset.commentThreadId);
  };

  const scheduleCommentPositions = () => {
    if (positionFrame) return;
    positionFrame = window.requestAnimationFrame(() => {
      positionFrame = null;
      positionCommentThreads(root, currentThreads());
    });
  };

  document.addEventListener("pointerdown", removePendingThreads, true);
  document.addEventListener("focusin", removePendingThreads, true);
  document.querySelector("[data-article-shadow]")?.shadowRoot?.addEventListener("click", onCommentMarkClick);
  window.addEventListener("scroll", scheduleCommentPositions, true);
  window.addEventListener("resize", scheduleCommentPositions);
  update();

  return { update };
}

function cssEscape(value) {
  return window.CSS?.escape ? window.CSS.escape(String(value)) : String(value).replace(/["\\]/g, "\\$&");
}

function commentAnchorElement(thread) {
  const shadowRoot = document.querySelector("[data-article-shadow]")?.shadowRoot;
  if (!shadowRoot || !thread?.threadId) return null;

  const inlineMark = shadowRoot.querySelector(`[data-comment-thread-id="${cssEscape(thread.threadId)}"]`);
  if (inlineMark) return inlineMark;

  if (!thread.fieldName) return null;
  const blockSelector = `[data-article-block][data-stream-field="${cssEscape(thread.fieldName)}"]`;
  const blocks = Array.from(shadowRoot.querySelectorAll(blockSelector));
  return (thread.blockId && blocks.find((block) => block.dataset.streamBlockId === String(thread.blockId))) || blocks[thread.blockIndex] || null;
}

function positionCommentThreads(root, threads) {
  const list = root.querySelector(".pm-comment-sidebar__list");
  if (!list) return;

  const listRect = list.getBoundingClientRect();
  const placements = threads.map((thread) => {
    const card = list.querySelector(`[data-comment-thread-id="${cssEscape(thread.threadId)}"]`);
    const anchor = commentAnchorElement(thread);
    return { thread, card, anchor };
  }).filter(({ card }) => card);

  const orderedPlacements = placements.map((placement, index) => {
    const anchorRect = placement.anchor?.getBoundingClientRect();
    return {
      ...placement,
      index,
      targetTop: anchorRect ? Math.max(0, anchorRect.top - listRect.top) : null,
    };
  }).sort((left, right) => (left.targetTop ?? Number.MAX_SAFE_INTEGER) - (right.targetTop ?? Number.MAX_SAFE_INTEGER) || left.index - right.index);

  let nextTop = 0;
  const gap = 12;
  for (const placement of orderedPlacements) {
    const targetTop = placement.targetTop ?? nextTop;
    const top = Math.max(targetTop, nextTop);
    placement.card.style.top = `${top}px`;
    placement.card.style.left = "0px";
    placement.card.style.right = "0px";
    nextTop = top + placement.card.offsetHeight + gap;
  }

  list.style.minHeight = placements.length ? `${nextTop - gap}px` : "";
}

function updateActiveCommentMarks(activeThreadId, threads = []) {
  const shadowRoot = document.querySelector("[data-article-shadow]")?.shadowRoot;
  if (!shadowRoot) return;

  shadowRoot.querySelectorAll("[data-comment-active]").forEach((element) => {
    element.removeAttribute("data-comment-active");
  });
  shadowRoot.querySelectorAll(".pm-article-block--comment-active").forEach((element) => {
    element.classList.remove("pm-article-block--comment-active");
  });
  if (!activeThreadId) return;

  shadowRoot.querySelectorAll(`[data-comment-thread-id="${cssEscape(activeThreadId)}"]`).forEach((element) => {
    element.setAttribute("data-comment-active", "true");
  });

  const activeThread = threads.find((thread) => thread.threadId === activeThreadId);
  const block = activeThread && activeThread.fieldName ? commentAnchorElement(activeThread) : null;
  block?.classList?.add("pm-article-block--comment-active");
}

function CommentSidebar({ threads, username, refresh, activeThreadId, setActiveThread }) {
  if (!threads.length) return null;

  return (
    <div className="pm-comment-sidebar__list">
      {threads.map((thread) => (
        <CommentThread
          key={thread.threadId}
          thread={thread}
          username={username}
          refresh={refresh}
          active={thread.threadId === activeThreadId && !thread.resolved}
          setActiveThread={setActiveThread}
        />
      ))}
    </div>
  );
}

function CommentThread({ thread, username, refresh, active, setActiveThread }) {
  const resolved = !thread.pending && Boolean(thread.resolved);
  const className = [
    "pm-comment-thread",
    resolved ? "pm-comment-thread--collapsed" : "",
    active ? "pm-comment-thread--active" : "",
  ].filter(Boolean).join(" ");

  return (
    <section
      className={className}
      data-comment-thread-id={thread.threadId}
      onClick={() => { if (!resolved) setActiveThread(thread.threadId); }}
    >
      {!thread.pending && (
        <button
          type="button"
          className="pm-comment-thread__collapse"
          title={resolved ? "Reopen comment" : "Resolve comment"}
          aria-label={resolved ? "Reopen comment" : "Resolve comment"}
          aria-pressed={String(resolved)}
          onClick={(event) => {
            event.stopPropagation();
            const nextResolved = !thread.resolved;
            const changed = thread.setResolved
              ? thread.setResolved(nextResolved)
              : setCommentThreadResolved(thread.view, thread.threadId, nextResolved);
            if (changed) refresh();
          }}
        >
          {resolved ? "✓" : ""}
        </button>
      )}

      {!resolved && (
        <>
          {thread.comments.length > 0 && (
            <div className="pm-comment-thread__comments">
              {thread.comments.map((comment) => (
                <article className="pm-comment" key={`${comment.createdAt}-${comment.username}-${comment.text}`}>
                  <div className="pm-comment__meta">
                    <strong>{comment.username}</strong>
                    <time dateTime={comment.createdAt}>{formatCommentDate(comment.createdAt)}</time>
                  </div>
                  <p>{comment.text}</p>
                </article>
              ))}
            </div>
          )}
          <CommentReplyForm thread={thread} username={username} refresh={refresh} />
        </>
      )}
    </section>
  );
}

function CommentReplyForm({ thread, username, refresh }) {
  return (
    <form
      className="pm-comment-reply"
      onInput={(event) => { event.stopPropagation(); }}
      onChange={(event) => { event.stopPropagation(); }}
      onSubmit={(event) => {
        event.preventDefault();
        const textarea = event.currentTarget.elements.comment;
        const text = textarea.value.trim();
        if (!username || !text) return;

        const comment = {
          username,
          text,
          createdAt: new Date().toISOString(),
        };
        if (thread.commit) thread.commit(comment);
        else appendCommentToThread(thread.view, thread.threadId, comment);
        textarea.value = "";
        refresh();
      }}
    >
      <div className="pm-comment-reply__author">{username}</div>
      <textarea
        name="comment"
        placeholder={thread.pending ? "Comment" : "Reply"}
        rows="3"
      />
      <button type="submit">{thread.pending ? "Comment" : "Reply"}</button>
    </form>
  );
}

function formatCommentDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export const commentMarkSpec = {
  attrs: {
    threadId: { default: null },
    comments: { default: [] },
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
    }, 0];
  },
};

function readCommentAttrs(dom) {
  return {
    threadId: dom.getAttribute("data-comment-thread-id"),
    comments: parseCommentPayload(dom.getAttribute("data-comment-comments")),
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

function collectCommentThreads(view) {
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

function appendCommentToThread(view, threadId, comment) {
  const thread = findCommentThread(view, threadId);
  if (!thread) return false;

  return replaceCommentThread(view, thread, {
    comments: [...thread.comments, comment],
    pending: false,
    resolved: false,
  });
}

function setCommentThreadResolved(view, threadId, resolved) {
  const thread = findCommentThread(view, threadId);
  if (!thread) return false;
  return replaceCommentThread(view, thread, { resolved: Boolean(resolved) });
}

function findCommentThread(view, threadId) {
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

    thread.ranges.push({ from: pos, to: pos + node.nodeSize });
    thread.comments = Array.isArray(mark.attrs.comments) ? mark.attrs.comments : [];
    thread.pending = Boolean(mark.attrs.pending);
    thread.resolved = Boolean(mark.attrs.resolved);
    return true;
  });

  return thread.ranges.length ? thread : null;
}

function replaceCommentThread(view, thread, attrs) {
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
      .addMark(range.from, range.to, thread.commentMark.create(nextAttrs));
  }
  view.dispatch(tr);
  return true;
}

function removeCommentThread(view, threadId) {
  const thread = findCommentThread(view, threadId);
  if (!thread) return false;

  let tr = view.state.tr;
  for (const range of thread.ranges) tr = tr.removeMark(range.from, range.to, thread.commentMark);
  view.dispatch(tr);
  return true;
}

export function setupFootnoteSidebar(root, { getViews }) {
  const reactRoot = createRoot(root);
  let hasRendered = false;
  let renderedFootnoteIds = new Set();

  const update = () => {
    const activeTextarea = root.contains(document.activeElement) ? document.activeElement : null;
    const activeFootnoteId = activeTextarea && activeTextarea.dataset.footnoteId;
    const selectionStart = activeTextarea && activeTextarea.selectionStart;
    const selectionEnd = activeTextarea && activeTextarea.selectionEnd;
    const footnotes = getViews().flatMap((view) => collectFootnotes(view));
    const footnoteIds = new Set(footnotes.map((footnote) => footnote.footnoteId));
    const newFootnote = hasRendered
      ? footnotes.find((footnote) => !renderedFootnoteIds.has(footnote.footnoteId))
      : null;

    reactRoot.render(
      <FootnotePanel
        footnotes={footnotes}
        refresh={update}
      />,
    );

    hasRendered = true;
    renderedFootnoteIds = footnoteIds;

    const nextActiveFootnoteId = activeFootnoteId || (newFootnote && newFootnote.footnoteId);
    if (!nextActiveFootnoteId) return;

    window.requestAnimationFrame(() => {
      const nextInput = root.querySelector(`[data-footnote-id="${nextActiveFootnoteId}"]`);
      nextInput.focus({ preventScroll: true });
      if (activeFootnoteId && Number.isInteger(selectionStart) && Number.isInteger(selectionEnd)) {
        nextInput.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  };

  update();
  return { update };
}

function FootnotePanel({ footnotes, refresh }) {
  if (!footnotes.length) return null;

  return (
    <section className="pm-footnote-panel">
      <h3 className="pm-footnote-panel__header">Footnotes</h3>
      {footnotes.map((footnote, index) => (
        <label className="pm-footnote" key={footnote.footnoteId}>
          <h3 className="pm-footnote__number">{index + 1}</h3>
          <textarea
            defaultValue={footnote.text}
            data-footnote-id={footnote.footnoteId}
            rows="1"
            onKeyDown={(event) => {
              if (event.key !== "Backspace" || event.currentTarget.value) return;
              event.preventDefault();
              removeFootnote(footnote.view, footnote.footnoteId);
              refresh();
            }}
            onInput={(event) => {
              updateFootnote(footnote.view, footnote.footnoteId, event.currentTarget.value);
              event.currentTarget.style.height = "auto";
              event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
            }}
            ref={(textarea) => {
              if (!textarea) return;
              textarea.style.height = "auto";
              textarea.style.height = `${textarea.scrollHeight}px`;
            }}
          />
        </label>
      ))}
    </section>
  );
}

export const footnoteMarkSpec = {
  inclusive: false,
  attrs: {
    footnoteId: { default: null },
    text: { default: "" },
    anchor: { default: false },
  },
  parseDOM: [{
    tag: "span[data-footnote-id]",
    getAttrs(dom) {
      return {
        footnoteId: dom.getAttribute("data-footnote-id"),
        text: dom.getAttribute("data-footnote-text") || "",
        anchor: dom.getAttribute("data-footnote-anchor") === "true",
      };
    },
  }],
  toDOM(mark) {
    const attrs = mark.attrs;
    return ["span", {
      "data-footnote-id": attrs.footnoteId || "",
      "data-footnote-text": attrs.text || "",
      "data-footnote-anchor": attrs.anchor ? "true" : "false",
    }, 0];
  },
};

const FOOTNOTE_ANCHOR_TEXT = "\u00a0";

export function startFootnoteCommand(footnoteMark) {
  return (state, dispatch) => {
    const { empty, $from } = state.selection;
    if (!empty) return false;

    const activeMark = footnoteMark.isInSet(state.storedMarks || $from.marks());
    if (!dispatch) return true;

    if (activeMark) {
      const range = markRangeAtCursor(state, footnoteMark, activeMark.attrs);
      let tr = state.tr.removeStoredMark(footnoteMark);
      if (range) tr = activeMark.attrs.anchor ? tr.delete(range.from, range.to) : tr.removeMark(range.from, range.to, footnoteMark);
      dispatch(tr.scrollIntoView());
      return true;
    }

    const footnoteId = uuidv4();
    const mark = footnoteMark.create({ footnoteId, text: "", anchor: true });
    dispatch(state.tr
      .replaceSelectionWith(state.schema.text(FOOTNOTE_ANCHOR_TEXT, [mark]), false)
      .removeStoredMark(footnoteMark)
      .scrollIntoView());
    return true;
  };
}

function collectFootnotes(view) {
  const footnotes = new Map();
  visitFootnoteMarks(view, ({ mark }) => {
    if (footnotes.has(mark.attrs.footnoteId)) return;
    footnotes.set(mark.attrs.footnoteId, {
      footnoteId: mark.attrs.footnoteId,
      text: mark.attrs.text || "",
      view,
    });
  });
  return Array.from(footnotes.values());
}

function updateFootnote(view, footnoteId, text) {
  const ranges = [];
  const footnoteMark = visitFootnoteMarks(view, ({ mark, from, to }) => {
    if (mark.attrs.footnoteId === footnoteId) ranges.push({ from, to, anchor: Boolean(mark.attrs.anchor) });
  });
  if (!footnoteMark || !ranges.length) return false;

  let tr = view.state.tr;
  for (const range of ranges) {
    tr = tr
      .removeMark(range.from, range.to, footnoteMark)
      .addMark(range.from, range.to, footnoteMark.create({ footnoteId, text, anchor: range.anchor }));
  }
  view.dispatch(tr);
  return true;
}

function removeFootnote(view, footnoteId) {
  const ranges = [];
  const footnoteMark = visitFootnoteMarks(view, ({ mark, node, from, to }) => {
    if (mark.attrs.footnoteId === footnoteId) ranges.push({ from, to, removeText: mark.attrs.anchor || node.text === FOOTNOTE_ANCHOR_TEXT });
  });
  if (!footnoteMark || !ranges.length) return false;

  let tr = view.state.tr;
  for (const range of ranges.reverse()) {
    tr = range.removeText
      ? tr.delete(range.from, range.to)
      : tr.removeMark(range.from, range.to, footnoteMark);
  }
  view.dispatch(tr.removeStoredMark(footnoteMark).scrollIntoView());
  return true;
}

function visitFootnoteMarks(view, callback) {
  const footnoteMark = view.state.schema.marks.footnote;
  if (!footnoteMark) return null;

  view.state.doc.descendants((node, pos) => {
    if (!node.isText) return true;
    const mark = footnoteMark.isInSet(node.marks);
    if (mark?.attrs?.footnoteId) callback({ mark, node, from: pos, to: pos + node.nodeSize });
    return true;
  });
  return footnoteMark;
}

export function markRangeAtCursor(state, markType, attrs = null) {
  const { $from } = state.selection;
  const parent = $from.parent;
  const offset = $from.parentOffset;
  let pos = 0;
  let match = null;
  let matchIndex = -1;
  let matchStart = 0;

  for (let index = 0; index < parent.childCount; index += 1) {
    const child = parent.child(index);
    const start = pos;
    const end = start + child.nodeSize;
    const mark = markType.isInSet(child.marks);
    if (mark && (!attrs || sameMarkAttrs(mark.attrs, attrs)) && start <= offset && offset <= end) {
      match = mark;
      matchIndex = index;
      matchStart = start;
      break;
    }
    pos = end;
  }

  if (!match) return null;

  let fromOffset = matchStart;
  let toOffset = matchStart + parent.child(matchIndex).nodeSize;

  for (let index = matchIndex - 1; index >= 0; index -= 1) {
    const child = parent.child(index);
    const mark = markType.isInSet(child.marks);
    if (!mark || !sameMarkAttrs(mark.attrs, match.attrs)) break;
    fromOffset -= child.nodeSize;
  }

  for (let index = matchIndex + 1; index < parent.childCount; index += 1) {
    const child = parent.child(index);
    const mark = markType.isInSet(child.marks);
    if (!mark || !sameMarkAttrs(mark.attrs, match.attrs)) break;
    toOffset += child.nodeSize;
  }

  const parentStart = $from.start();
  return { from: parentStart + fromOffset, to: parentStart + toOffset, attrs: match.attrs };
}

function sameMarkAttrs(left, right) {
  return JSON.stringify(left || {}) === JSON.stringify(right || {});
}
