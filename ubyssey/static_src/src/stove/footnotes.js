import { collectFootnotes, removeFootnote, updateFootnote } from "./prosemirror_base";

export function setupFootnoteSidebar(root, { getViews = () => [] } = {}) {
  if (!root) return null;

  let hasRendered = false;
  let renderedFootnoteIds = new Set();
  const api = { update };
  update();
  return api;

  function update() {
    const activeTextarea = root.contains(document.activeElement) ? document.activeElement : null;
    const activeFootnoteId = activeTextarea?.dataset?.footnoteId || null;
    const selectionStart = activeTextarea?.selectionStart;
    const selectionEnd = activeTextarea?.selectionEnd;
    const footnotes = getViews()
      .filter((view) => view?.state?.doc)
      .flatMap((view) => collectFootnotes(view));
    const footnoteIds = new Set(footnotes.map((footnote) => footnote.footnoteId));
    const newFootnote = hasRendered
      ? footnotes.find((footnote) => !renderedFootnoteIds.has(footnote.footnoteId))
      : null;
    root.replaceChildren();

    if (!footnotes.length) {
      hasRendered = true;
      renderedFootnoteIds = footnoteIds;
      return;
    }

    const panel = document.createElement("section");
    panel.className = "pm-footnote-panel";

    const header = document.createElement("h3");
    header.className = "pm-footnote-panel__header";
    header.textContent = "Footnotes";
    panel.appendChild(header);

    footnotes.forEach((footnote, index) => {
      const item = document.createElement("label");
      item.className = "pm-footnote";

      const number = document.createElement("span");
      number.className = "pm-footnote__number";
      number.textContent = String(index + 1);

      const text = document.createElement("textarea");
      text.value = footnote.text || "";
      text.dataset.footnoteId = footnote.footnoteId;
      text.rows = 1;
      text.addEventListener("keydown", (event) => {
        if (event.key === "Backspace" && !text.value) {
          event.preventDefault();
          removeFootnote(footnote.view, footnote.footnoteId);
        }
      });
      text.addEventListener("input", () => {
        updateFootnote(footnote.view, footnote.footnoteId, text.value);
      });

      item.append(number, text);
      panel.appendChild(item);
    });

    root.appendChild(panel);
    root.querySelectorAll("textarea").forEach((textarea) => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    });

    const nextActiveFootnoteId = activeFootnoteId || newFootnote?.footnoteId;
    hasRendered = true;
    renderedFootnoteIds = footnoteIds;

    if (nextActiveFootnoteId) {
      const nextInput = root.querySelector(`[data-footnote-id="${nextActiveFootnoteId}"]`);
      nextInput?.focus({ preventScroll: true });
      if (activeFootnoteId && Number.isInteger(selectionStart) && Number.isInteger(selectionEnd)) {
        nextInput?.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }
}
