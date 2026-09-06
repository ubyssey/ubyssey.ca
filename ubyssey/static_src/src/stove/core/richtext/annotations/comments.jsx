// Comment UI
// todo: figure out why transitions only work on some computers (performance?)

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import {
  acceptSuggestion,
  appendThreadComment,
  collectAnnotationThreads,
  commentSuggestion,
  removeAnnotationThread,
  rejectSuggestion,
  setCommentThreadResolved,
  suggestionLabel,
} from "./comment_model.js";

export function setupCommentSidebar(root, { getViews, getThreads }) {
  const username = document.querySelector("[data-current-editor-username]").dataset.currentEditorUsername;
  const pageShadow = document.querySelector("[data-page-shadow]");
  const reactRoot = createRoot(root);
  let activeThreadId = null;
  let focusActiveReply = false;
  let positionFrame = null;
  let hasRendered = false;
  let renderedThreadIds = new Set();
  let scrollActiveThread = null;
  let scrollEndCleanup = null;
  let moveTimer = null;
  let commentOffset = 0;
  let clickedThreadIds = [];
  let clickedThreadIndex = 0;
  const commentDrafts = new Map();

  const currentThreads = () => [
    ...collectAnnotationThreads(getViews()),
    ...getThreads(),
  ].filter((thread) => !thread.resolved);

  const activeDraftHasText = () => Boolean(
    root.querySelector(".pm-comment-thread--active textarea")?.value.trim(),
  );

  const centerThreadAfterScroll = (threadId) => {
    scrollEndCleanup?.();
    let timer = null;

    const cleanup = () => {
      clearTimeout(timer);
      document.removeEventListener("scrollend", finish);
      window.removeEventListener("scroll", onScroll, true);
      if (scrollEndCleanup === cleanup) scrollEndCleanup = null;
    };
    const finish = () => {
      cleanup();
      if (activeThreadId !== threadId) return;
      scrollActiveThread = "center";
      scheduleCommentPositions();
    };
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(finish, 200);
    };

    scrollEndCleanup = cleanup;
    if ("onscrollend" in document) {
      document.addEventListener("scrollend", finish, { once: true });
    } else {
      window.addEventListener("scroll", onScroll, true);
      onScroll();
    }
  };

  const setActiveThread = (threadId, scroll = "center", focusReply = false) => {
    if (threadId && threadId !== activeThreadId && activeDraftHasText()) return;
    let anchorScrolled = false;
    if (scroll === "nearest") {
      const thread = currentThreads().find((item) => item.threadId === threadId);
      const anchor = commentAnchorElement(thread);
      const anchorRect = anchor?.getBoundingClientRect();
      const topbarBottom = document.querySelector(".page-editor-topbar")?.getBoundingClientRect().bottom || 0;
      const toolbarRect = pageShadow?.shadowRoot?.querySelector(".pm-page-toolbar")?.getBoundingClientRect();
      const visibleTop = toolbarRect?.top <= topbarBottom ? Math.max(topbarBottom, toolbarRect.bottom) : topbarBottom;
      if (anchorRect && (anchorRect.bottom <= visibleTop || anchorRect.top >= window.innerHeight)) {
        anchor.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        anchorScrolled = true;
      }
    }
    activeThreadId = threadId;
    focusActiveReply = focusReply;
    scrollActiveThread = scroll;
    update();
    if (anchorScrolled) centerThreadAfterScroll(threadId);
  };

  const clearActiveThread = () => {
    if (!activeThreadId) return;
    activeThreadId = null;
    focusActiveReply = false;
    scrollActiveThread = null;
    update();
  };

  const update = () => {
    const threads = currentThreads();
    const newThread = hasRendered ? threads.find((thread) => thread.pending && !renderedThreadIds.has(thread.threadId)) : null;
    hasRendered = true;
    renderedThreadIds = new Set(threads.map((thread) => thread.threadId));
    if (newThread) {
      activeThreadId = newThread.threadId;
      focusActiveReply = true;
      scrollActiveThread = "center";
    }
    if (activeThreadId && !threads.some((thread) => thread.threadId === activeThreadId && !thread.resolved)) activeThreadId = null;
    flushSync(() => {
      reactRoot.render(
        <CommentSidebar
          threads={threads}
          username={username}
          refresh={update}
          activeThreadId={activeThreadId}
          focusActiveReply={focusActiveReply}
          setActiveThread={setActiveThread}
          commentDrafts={commentDrafts}
        />,
      );
    });
    scheduleCommentPositions();
    updateActiveCommentMarks(activeThreadId, threads);
  };

  const eventPath = (event) => event.composedPath?.() || [];
  const eventCommentCard = (event) => eventPath(event).find((element) => element?.matches?.(".pm-comment-thread"));
  const eventCommentMark = (event) => eventPath(event).find((element) => element?.matches?.("[data-comment-thread-id], [data-suggestion-thread-id]"));

  const removePendingThreads = (event) => {
    if (event.type === "focusin" && eventPath(event).includes(pageShadow)) return;

    const commentMark = eventCommentMark(event);
    if (eventCommentCard(event) || commentMark || activeDraftHasText()) return;

    clearActiveThread();
    
    let changed = false;
    currentThreads().forEach((thread) => {
      if (!thread.pending) return;
      changed = (thread.remove ? thread.remove() : removeAnnotationThread(thread)) || changed;
    });
    if (changed) update();
  };

  // switches selected overlapping suggestion/comment on second click
  const onCommentMarkClick = (event) => {
    const marks = eventPath(event).filter((element) => (
      element?.matches?.("[data-comment-thread-id], [data-suggestion-thread-id]")
      && element.dataset.commentResolved !== "true"
      && element.dataset.suggestionResolved !== "true"
    ));
    const threadIds = [...new Set(marks.map((mark) => (
      mark.dataset.commentThreadId || mark.dataset.suggestionThreadId
    )))];
    if (!threadIds.length) return;

    if (threadIds.join(":") === clickedThreadIds.join(":")) {
      clickedThreadIndex = (clickedThreadIndex + 1) % threadIds.length;
    } else {
      clickedThreadIds = threadIds;
      clickedThreadIndex = 0;
    }
    setActiveThread(threadIds[clickedThreadIndex]);
  };

  const scheduleCommentPositions = () => {
    if (positionFrame) return;
    positionFrame = window.requestAnimationFrame(() => {
      positionFrame = null;

      if (scrollActiveThread) {
        clearTimeout(moveTimer);
        moveTimer = null;
        root.classList.remove("pm-comment-sidebar--moving");
      }

      const threads = currentThreads();
      root.querySelectorAll(".pm-comment-thread").forEach((comment) => {
        layoutObserver.observe(comment);
      });
      
      positionCommentThreads(root, threads, commentOffset);

      if (scrollActiveThread && activeThreadId) {
        const comment = root.querySelector(`[data-comment-thread-id="${cssEscape(activeThreadId)}"]`);
        const commentRect = comment?.getBoundingClientRect();

        if (commentRect && scrollActiveThread === "center") {
          commentOffset += commentRect.top - (window.innerHeight - commentRect.height) / 2;
        } else if (commentRect?.bottom > window.innerHeight) {
          commentOffset += commentRect.bottom - window.innerHeight + 12;
        }

        root.classList.add("pm-comment-sidebar--moving");
        void root.offsetHeight;
        positionCommentThreads(root, threads, commentOffset);

        moveTimer = setTimeout(() => {
          moveTimer = null;
          root.classList.remove("pm-comment-sidebar--moving");
        }, 200);
        scrollActiveThread = null;
      }
    });
  };

  const layoutObserver = new ResizeObserver(scheduleCommentPositions);
  layoutObserver.observe(root);
  if (pageShadow) layoutObserver.observe(pageShadow);

  document.addEventListener("click", removePendingThreads, true);
  document.addEventListener("focusin", removePendingThreads, true);
  pageShadow?.shadowRoot?.addEventListener("click", onCommentMarkClick);
  window.addEventListener("scroll", scheduleCommentPositions, true);
  window.addEventListener("resize", scheduleCommentPositions);
  update();

  return {
    update,
    activateThread(threadId) {
      setActiveThread(threadId, null);
    },
  };
}

export function cssEscape(value) {
  return window.CSS?.escape ? window.CSS.escape(String(value)) : String(value).replace(/["\\]/g, "\\$&");
}

function commentAnchorElement(thread) {
  const shadowRoot = document.querySelector("[data-page-shadow]")?.shadowRoot;
  if (!shadowRoot || !thread?.threadId) return null;

  const inlineMark = shadowRoot.querySelector(`[data-${thread.kind}-thread-id="${cssEscape(thread.threadId)}"]`);
  if (inlineMark) return inlineMark;

  if (!thread.fieldName) return null;
  const blockSelector = `[data-article-block][data-stream-field="${cssEscape(thread.fieldName)}"]`;
  const blocks = Array.from(shadowRoot.querySelectorAll(blockSelector)).filter((block) => {
    const parentBlock = block.parentElement?.closest(blockSelector);
    return !parentBlock || !shadowRoot.contains(parentBlock);
  });
  if (thread.blockId) {
    return blocks.find((block) => block.dataset.streamBlockId === String(thread.blockId)) || null;
  }
  return blocks[thread.blockIndex] || null;
}

function positionCommentThreads(root, threads, offset) {
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
      targetTop: anchorRect ? anchorRect.top - listRect.top - offset : null,
    };
  }).sort((left, right) => (left.targetTop ?? Number.MAX_SAFE_INTEGER) - (right.targetTop ?? Number.MAX_SAFE_INTEGER) || left.index - right.index);

  let nextTop = -offset;
  const gap = 12;
  for (const placement of orderedPlacements) {
    const targetTop = placement.targetTop ?? nextTop;
    const top = Math.max(targetTop, nextTop);
    placement.card.style.top = `${top}px`;
    placement.card.style.left = "0px";
    placement.card.style.right = "0px";
    const height = placement.card.offsetHeight;
    nextTop = top + height + gap;
  }

  list.style.minHeight = placements.length ? `${nextTop - gap}px` : "";
}

function updateActiveCommentMarks(activeThreadId, threads = []) {
  const shadowRoot = document.querySelector("[data-page-shadow]")?.shadowRoot;
  if (!shadowRoot) return;

  shadowRoot.querySelectorAll("[data-comment-active]").forEach((element) => {
    element.removeAttribute("data-comment-active");
  });
  shadowRoot.querySelectorAll(".pm-page-block--comment-active").forEach((element) => {
    element.classList.remove("pm-page-block--comment-active");
  });

  new Set(threads.flatMap((thread) => thread.views || [thread.view]).filter(Boolean)).forEach((view) => {
    if (view.activeCommentThreadId === activeThreadId) return;
    view.activeCommentThreadId = activeThreadId;
    view.dispatch(view.state.tr.setMeta("activeCommentThread", activeThreadId));
  });

  if (!activeThreadId) return;

  shadowRoot.querySelectorAll(`[data-comment-thread-id="${cssEscape(activeThreadId)}"], [data-suggestion-thread-id="${cssEscape(activeThreadId)}"]`).forEach((element) => {
    element.setAttribute("data-comment-active", "true");
  });

  const activeThread = threads.find((thread) => thread.threadId === activeThreadId);
  const block = activeThread && activeThread.fieldName ? commentAnchorElement(activeThread) : null;
  block?.classList?.add("pm-page-block--comment-active");
}

function CommentSidebar({ threads, username, refresh, activeThreadId, focusActiveReply, setActiveThread, commentDrafts }) {
  if (!threads.length) return null;

  return (
    <div className="pm-comment-sidebar__list">
      {threads.map((thread) => (
        <CommentThread
          key={`${thread.kind}:${thread.threadId}`}
          thread={thread}
          username={username}
          refresh={refresh}
          active={thread.threadId === activeThreadId}
          focusReply={thread.threadId === activeThreadId && focusActiveReply}
          setActiveThread={setActiveThread}
          commentDrafts={commentDrafts}
        />
      ))}
    </div>
  );
}

function CommentThread({ thread, username, refresh, active, focusReply, setActiveThread, commentDrafts }) {
  const suggestion = thread.kind === "suggestion";
  const suggestionType = commentSuggestion(thread.comments);
  const refocusEditor = () => window.requestAnimationFrame(() => thread.view?.focus());
  const className = active ? "pm-comment-thread pm-comment-thread--active" : "pm-comment-thread";

  const resolveLabel = suggestion ? "Accept suggestion" : "Resolve comment";
  const resolveButton = !thread.pending && (
    <button
      type="button"
      className="pm-comment-thread__collapse"
      title={resolveLabel}
      aria-label={resolveLabel}
      onPointerDown={(event) => { event.stopPropagation(); }}
      onClick={(event) => {
        event.stopPropagation();
        let changed;
        if (suggestion) {
          changed = acceptSuggestion(thread, suggestionType);
        } else {
          changed = thread.setResolved
            ? thread.setResolved(true)
            : setCommentThreadResolved(thread, true);
        }
        if (changed) {
          refresh();
          if (suggestion) refocusEditor();
        }
      }}
    >
      ✓
    </button>
  );
  const rejectButton = suggestion && (
    <button
      type="button"
      className="pm-comment-thread__collapse"
      title="Reject suggestion"
      aria-label="Reject suggestion"
      onPointerDown={(event) => { event.stopPropagation(); }}
      onClick={(event) => {
        event.stopPropagation();
        if (rejectSuggestion(thread, suggestionType)) {
          refresh();
          refocusEditor();
        }
      }}
    >
      X
    </button>
  );

  return (
    <section
      className={className}
      data-comment-thread-id={thread.threadId}
      onPointerDown={() => {
        if (!active) window.requestAnimationFrame(() => {
          setActiveThread(thread.threadId, "nearest", true);
        });
      }}
    >
      {thread.comments.length > 0 && (
        <div className="pm-comment-thread__comments">
          {thread.comments.map((comment, index) => (
            <Comment
              key={`${comment.createdAt}-${comment.username}-${comment.text}`}
              comment={comment}
              resolveButton={index === 0 ? (
                <>
                  {resolveButton}
                  {rejectButton}
                </>
              ) : null}
            />
          ))}
        </div>
      )}
      {active && (
        <CommentReplyForm
          thread={thread}
          username={username}
          draft={commentDrafts.get(thread.threadId) || ""}
          focusOnMount={focusReply && !suggestion}
          setStoredDraft={(value) => { commentDrafts.set(thread.threadId, value); }}
          close={() => { setActiveThread(null, null); }}
          cancel={() => {
            commentDrafts.delete(thread.threadId);
            if (thread.pending) {
              if (thread.remove) thread.remove();
              else removeAnnotationThread(thread);
            }
            setActiveThread(null, null);
          }}
        />
      )}
    </section>
  );
}

function Comment({ comment, resolveButton }) {
  return (
    <article className="pm-comment">
      <div className="pm-comment__meta">
        <strong>{comment.username}</strong>
        <time dateTime={comment.createdAt}>{formatCommentDate(comment.createdAt)}</time>
        {resolveButton}
      </div>
      <p><CommentText comment={comment} /></p>
    </article>
  );
}

function CommentText({ comment }) {
  if (!comment.suggestion) return comment.text;

  return (
    <>
      <strong>{suggestionLabel(comment.suggestion)}:</strong>
      {comment.text && ` ${comment.text}`}
    </>
  );
}

function CommentReplyForm({ thread, username, draft: initialDraft, setStoredDraft, focusOnMount, close, cancel }) {
  // Comment Draft State
  const [draft, setDraft] = useState(initialDraft);

  const textareaRef = useRef(null);
  useEffect(() => {
    if (focusOnMount) textareaRef.current?.focus({ preventScroll: true });
  }, [focusOnMount]);
  
  const updateDraft = (value) => {
    setStoredDraft(value);
    setDraft(value);
  };

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
        else appendThreadComment(thread, comment);
        updateDraft("");
        close();
      }}
    >
      <div className="pm-comment-reply__author">{username}</div>
      <textarea
        ref={textareaRef}
        name="comment"
        value={draft}
        onChange={(event) => { updateDraft(event.currentTarget.value); }}
        placeholder={thread.pending ? "Comment" : "Reply"}
        rows="2"
      />
      <div className="pm-comment-reply__actions">
        <button type="submit">{thread.pending ? "Comment" : "Reply"}</button>
        <button type="button" className="pm-comment-reply__cancel" onClick={cancel}>Cancel</button>
      </div>
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
