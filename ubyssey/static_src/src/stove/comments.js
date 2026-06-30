import { appendCommentToThread, collectCommentThreads, removeCommentThread, setCommentThreadResolved } from "./prosemirror_base";

export function setupCommentSidebar(root, { getViews = () => [], getThreads = () => [], username = currentEditorUsername() } = {}) {
  if (!root) return null;

  document.addEventListener("pointerdown", handleOutsidePointerDown, true);
  document.addEventListener("focusin", handleOutsidePointerDown, true);

  const api = { update };
  update();
  return api;

  function update() {
    const threads = currentThreads();

    root.replaceChildren();

    if (!threads.length) { return; }

    const list = document.createElement("div");
    list.className = "pm-comment-sidebar__list";
    for (const thread of threads) list.appendChild(createThreadCard(thread));
    root.appendChild(list);
  }

  function createThreadCard(thread) {
    const resolved = !thread.pending && Boolean(thread.resolved);
    const card = document.createElement("section");
    card.className = `pm-comment-thread${resolved ? " pm-comment-thread--collapsed" : ""}`;

    if (!thread.pending) card.appendChild(createResolveButton(thread, resolved));
    if (resolved) return card;

    const comments = document.createElement("div");
    comments.className = "pm-comment-thread__comments";
    for (const comment of thread.comments || []) comments.appendChild(createComment(comment));
    if (comments.childElementCount) card.appendChild(comments);
    card.appendChild(createReplyForm(thread));
    return card;
  }

  function createResolveButton(thread, resolved) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pm-comment-thread__collapse";
    button.textContent = resolved ? "✓" : "";
    button.title = resolved ? "Reopen comment" : "Resolve comment";
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(resolved));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const nextResolved = !thread.resolved;
      const changed = thread.setResolved
        ? thread.setResolved(nextResolved)
        : setCommentThreadResolved(thread.view, thread.threadId, nextResolved);
      if (changed) update();
    });
    return button;
  }

  function createComment(comment) {
    const item = document.createElement("article");
    item.className = "pm-comment";

    const meta = document.createElement("div");
    meta.className = "pm-comment__meta";

    const author = document.createElement("strong");
    author.textContent = comment.username || "Anonymous";

    const time = document.createElement("time");
    time.dateTime = comment.createdAt || "";
    time.textContent = formatDate(comment.createdAt);

    const text = document.createElement("p");
    text.textContent = comment.text || "";

    meta.appendChild(author);
    meta.appendChild(time);
    item.appendChild(meta);
    item.appendChild(text);
    return item;
  }

  function createReplyForm(thread) {
    const form = document.createElement("form");
    form.className = "pm-comment-reply";

    const author = document.createElement("div");
    author.className = "pm-comment-reply__author";
    author.textContent = username;

    const text = document.createElement("textarea");
    text.name = "comment";
    text.placeholder = thread.pending ? "Comment" : "Reply";
    text.rows = 3;

    const button = document.createElement("button");
    button.type = "submit";
    button.textContent = thread.pending ? "Comment" : "Reply";

    form.appendChild(author);
    form.appendChild(text);
    form.appendChild(button);
    form.addEventListener("input", (event) => { event.stopPropagation(); });
    form.addEventListener("change", (event) => { event.stopPropagation(); });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const nextText = text.value.trim();
      if (!username || !nextText) return;

      const comment = {
        username,
        text: nextText,
        createdAt: new Date().toISOString(),
      };
      if (thread.commit) thread.commit(comment);
      else appendCommentToThread(thread.view, thread.threadId, comment);
      update();
    });

    if (thread.pending) {
      window.setTimeout(() => { text.focus(); }, 0);
    }

    return form;
  }

  function currentThreads() {
    return [
      ...getViews()
        .filter((view) => view?.state?.doc)
        .flatMap((view) => collectCommentThreads(view)),
      ...getThreads(),
    ];
  }

  function handleOutsidePointerDown(event) {
    if (root.contains(event.target)) return;

    let changed = false;
    for (const thread of currentThreads()) {
      if (!thread.pending) continue;
      changed = (thread.remove ? thread.remove() : removeCommentThread(thread.view, thread.threadId)) || changed;
    }
    if (changed) update();
  }
}

// sdnfkdsjkfnsdjknjksdnfjksdn why
function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
function currentEditorUsername() {
  return document.querySelector("[data-current-editor-username]")?.dataset.currentEditorUsername || "Unknown User (who could it be?)";
}
