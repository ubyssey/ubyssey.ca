import { createRoot } from "react-dom/client";
import { collectFootnotes, removeFootnote, updateFootnote } from "./prosemirror_base";

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
