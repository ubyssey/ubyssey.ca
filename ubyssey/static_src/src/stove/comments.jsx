import { createRoot } from "react-dom/client";
import { appendCommentToThread, collectCommentThreads, removeCommentThread, setCommentThreadResolved } from "./prosemirror_base";

export function setupCommentSidebar(root, { getViews, getThreads }) {
  const username = document.querySelector("[data-current-editor-username]").dataset.currentEditorUsername;
  const reactRoot = createRoot(root);

  const currentThreads = () => [
    ...getViews().flatMap((view) => collectCommentThreads(view)),
    ...getThreads(),
  ];

  const update = () => {
    reactRoot.render(
      <CommentSidebar
        threads={currentThreads()}
        username={username}
        refresh={update}
      />,
    );
  };

  const removePendingThreads = (event) => {
    if (root.contains(event.target)) return;

    let changed = false;
    currentThreads().forEach((thread) => {
      if (!thread.pending) return;
      changed = (thread.remove ? thread.remove() : removeCommentThread(thread.view, thread.threadId)) || changed;
    });
    if (changed) update();
  };

  document.addEventListener("pointerdown", removePendingThreads, true);
  document.addEventListener("focusin", removePendingThreads, true);
  update();

  return { update };
}

function CommentSidebar({ threads, username, refresh }) {
  if (!threads.length) return null;

  return (
    <div className="pm-comment-sidebar__list">
      {threads.map((thread) => (
        <CommentThread
          key={thread.threadId}
          thread={thread}
          username={username}
          refresh={refresh}
        />
      ))}
    </div>
  );
}

function CommentThread({ thread, username, refresh }) {
  const resolved = !thread.pending && Boolean(thread.resolved);

  return (
    <section className={`pm-comment-thread${resolved ? " pm-comment-thread--collapsed" : ""}`}>
      {!thread.pending && (
        <button
          type="button"
          className="pm-comment-thread__collapse"
          title={resolved ? "Reopen comment" : "Resolve comment"}
          aria-label={resolved ? "Reopen comment" : "Resolve comment"}
          aria-pressed={String(resolved)}
          onClick={() => {
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
        refresh();
      }}
    >
      <div className="pm-comment-reply__author">{username}</div>
      <textarea
        name="comment"
        placeholder={thread.pending ? "Comment" : "Reply"}
        rows="3"
        autoFocus={thread.pending}
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
