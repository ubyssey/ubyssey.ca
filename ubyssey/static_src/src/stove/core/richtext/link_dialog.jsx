// Insert link modal

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { TextSelection } from "prosemirror-state";

import { createSuggestionMark, markRangeAtCursor } from "./annotations/index.js";
import { ACTIVE_SUGGESTION_THREAD_META, suggestionModeIsActive } from "./suggestion_mode.js";

export function promptLinkCommand(linkMark) {
  return (state, dispatch, view) => {
    if (!dispatch || !view) return true;

    const { from, to, empty } = state.selection;

    const range = empty ? markRangeAtCursor(state, linkMark) : {from, to};
    const attrs = range?.attrs || linkMark.isInSet(state.storedMarks || state.selection.$from.marks())?.attrs;

    openLinkModal({
      href: attrs?.href || "",  
      alias: range ? state.doc.textBetween(range.from, range.to) : "",
      onSubmit: (values) => applyLink(view, linkMark, range, values),
      onCancel: () => { view.focus(); },
    });

    return true;
  };
}

function applyLink(view, linkMark, range, { href: rawHref, alias: rawAlias }) {
  let href = String(rawHref || "").trim();
  if (/^(javascript|data):/i.test(href)) {
    window.alert("Links cannot use javascript: or data: URLs.");
    return false;
  }
  if (href && !/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^[#/?]/.test(href)) href = `https://${href}`;

  const { state } = view;
  let tr = state.tr;
  if (!href) {
    tr = range ? tr.removeMark(range.from, range.to, linkMark) : tr.removeStoredMark(linkMark);
  } else {
    const text = String(rawAlias || "").trim() || href;
    const mark = linkMark.create({ href });
    const oldText = range && state.doc.textBetween(range.from, range.to);

    const suggestionTransaction = suggestionModeIsActive() && view.annotationsEnabled !== false ? suggestedLinkTransaction(state, linkMark, mark, range, text) : null;
    
    if (suggestionTransaction) {
      tr = suggestionTransaction;
    } else if (range && text === oldText) {
      tr = tr.removeMark(range.from, range.to, linkMark).addMark(range.from, range.to, mark);
    } else {
      const marks = range ? marksAtRangeStart(state, range.from) : state.storedMarks || state.selection.$from.marks();
      const textNode = state.schema.text(text, [...marks.filter((item) => item.type !== linkMark), mark]);
      tr = range ? tr.replaceWith(range.from, range.to, textNode) : tr.replaceSelectionWith(textNode, false);
    }
    tr = tr.removeStoredMark(linkMark);
  }

  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

function suggestedLinkTransaction(state, linkMark, link, range, text) {
  const suggestionMark = state.schema.marks.suggestion;
  if (!suggestionMark || (range && state.doc.rangeHasMark(range.from, range.to, suggestionMark))) return null;
  const existingLink = range && linkMark.isInSet(state.doc.resolve(range.from).nodeAfter?.marks || []);
  if (range && existingLink?.attrs.href === link.attrs.href && text === state.doc.textBetween(range.from, range.to)) return null;

  const sourceMarks = range ? marksAtRangeStart(state, range.from) : state.storedMarks || state.selection.$from.marks();
  const linkedText = state.schema.text(text, [
    ...sourceMarks.filter((mark) => mark.type !== linkMark && mark.type !== suggestionMark),
    link,
  ]);

  if (!range) {
    let tr = state.tr.replaceSelectionWith(linkedText, false);
    const insertedTo = tr.selection.from;
    const insertedFrom = insertedTo - linkedText.nodeSize;
    const addMark = createSuggestionMark(suggestionMark, "add", text);
    return tr
      .addMark(insertedFrom, insertedTo, addMark)
      .setMeta(ACTIVE_SUGGESTION_THREAD_META, addMark.attrs.threadId);
  }

  const deleteMark = createSuggestionMark(suggestionMark, "replace", state.doc.textBetween(range.from, range.to, " "));
  const addMark = createSuggestionMark(
    suggestionMark,
    "replace",
    text,
    deleteMark.attrs.threadId,
    "add",
    text,
  );
  const insertedFrom = range.to;
  const insertedTo = insertedFrom + linkedText.nodeSize;
  const tr = state.tr
    .insert(insertedFrom, linkedText)
    .addMark(range.from, range.to, deleteMark)
    .addMark(insertedFrom, insertedTo, addMark);
  return tr
    .setSelection(TextSelection.create(tr.doc, insertedTo))
    .setMeta(ACTIVE_SUGGESTION_THREAD_META, deleteMark.attrs.threadId);
}

function marksAtRangeStart(state, position) {
  const resolved = state.doc.resolve(position);
  const marks = [...resolved.marks(), ...(resolved.nodeAfter?.marks || [])];
  return marks.filter((mark, index) => marks.findIndex((item) => item.type === mark.type) === index);
}

function openLinkModal(props) {
  const mount = document.body.appendChild(document.createElement("div"));
  const root = createRoot(mount);
  const close = () => {
    root.unmount();
    mount.remove();
  };

  root.render(
    <LinkModal
      {...props}
      onSubmit={(values) => {
        if (props.onSubmit(values)) close();
      }}
      onCancel={() => {
        close();
        props.onCancel?.();
      }}
    />,
  );
}

function LinkModal({ href, alias, onSubmit, onCancel }) {
  const [values, setValues] = useState({ href, alias });
  const aliasInput = useRef(null);
  const hrefInput = useRef(null);
  const updateValue = (key) => (event) => {
    const { value } = event.currentTarget;
    setValues((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    (alias ? hrefInput.current : aliasInput.current)?.focus();
  }, [alias]);

  return (
    <div
      className="page-editor-modal pm-link-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pm-link-modal-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <button
        type="button"
        className="page-editor-modal__backdrop"
        aria-label="Close link dialog"
        onClick={onCancel}
      />
      <form
        className="page-editor-modal__panel pm-link-modal__panel"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(values);
        }}
      >
        <header className="page-editor-modal__header">
          <h2 id="pm-link-modal-title">Insert Link</h2>
          <button
            type="button"
            className="page-editor-modal__close"
            aria-label="Close link dialog"
            onClick={onCancel}
          >
            x
          </button>
        </header>
        <label className="pm-link-modal__field">
          <span>Alias</span>
          <input
            ref={aliasInput}
            name="alias"
            type="text"
            placeholder="example"
            value={values.alias}
            onChange={updateValue("alias")}
          />
        </label>
        <label className="pm-link-modal__field">
          <span>Link</span>
          <input
            ref={hrefInput}
            name="href"
            type="text"
            placeholder="example.com"
            value={values.href}
            onChange={updateValue("href")}
          />
        </label>
        <footer className="page-editor-modal__footer">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" onClick={(event) => { onSubmit(values); }}>Insert</button>
        </footer>
      </form>
    </div>
  );
}
