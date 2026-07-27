// Insert link modal

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { markRangeAtCursor } from "../annotations/index.js";

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

  let tr = view.state.tr;
  if (!href) {
    tr = range ? tr.removeMark(range.from, range.to, linkMark) : tr.removeStoredMark(linkMark);
  } else {
    const text = String(rawAlias || "").trim() || href;
    const mark = linkMark.create({ href });
    tr = range
      ? tr.replaceWith(range.from, range.to, view.state.schema.text(text, [mark]))
      : tr.replaceSelectionWith(view.state.schema.text(text, [mark]), false);
    tr = tr.removeStoredMark(linkMark);
  }

  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
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
      className="article-media-modal pm-link-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pm-link-modal-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <button
        type="button"
        className="article-media-modal__backdrop"
        aria-label="Close link dialog"
        onClick={onCancel}
      />
      <form
        className="article-media-modal__panel pm-link-modal__panel"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(values);
        }}
      >
        <header className="article-media-modal__header">
          <h2 id="pm-link-modal-title">Insert Link</h2>
          <button
            type="button"
            className="article-media-modal__close"
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
        <footer className="article-media-modal__footer">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit">Insert</button>
        </footer>
      </form>
    </div>
  );
}
