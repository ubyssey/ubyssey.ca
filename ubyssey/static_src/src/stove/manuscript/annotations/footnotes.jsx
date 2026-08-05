// Footnotes

import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { Schema } from "prosemirror-model";
import { EditorState, Plugin, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { baseKeymap } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { createRoot } from "react-dom/client";
import { v4 as uuidv4 } from "uuid";

import { manuscriptSession } from "../session.js";
import { cssEscape } from "./comments.jsx";
import { markRangeAtCursor } from "./marks.js";
import { newSharedText, updateSharedText } from "../collab/metadata/shared.js";

export function setupFootnoteSidebar(root, { getViews }) {
  const articleShadowRoot = document.querySelector("[data-article-shadow]")?.shadowRoot;
  const reactRoot = createRoot(root);
  let hasRendered = false;
  let renderedFootnoteIds = new Set();

  const focusFootnote = (footnoteId) => {
    const input = root.querySelector(`[data-footnote-id="${cssEscape(footnoteId)}"]`);
    if (!input) return false;

    // Potentially add depth to bottom of footnotes so we can scroll the lowest footnote to the middle
    const rootRect = root.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const centeredTop = root.scrollTop + inputRect.top - rootRect.top - (root.clientHeight - inputRect.height) / 2;
    root.scrollTo({ top: Math.max(0, centeredTop), behavior: "smooth" });
    input.focus({ preventScroll: true });
    return true;
  };

  articleShadowRoot?.addEventListener("click", (event) => {
    const anchor = event.target.closest?.('[data-footnote-id][data-footnote-anchor="true"]');
    if (!anchor || !articleShadowRoot.contains(anchor)) return;

    event.preventDefault();
    focusFootnote(anchor.dataset.footnoteId);
  });

  const update = () => {
    const activeInput = root.contains(document.activeElement) ? document.activeElement : null;
    const activeFootnoteId = activeInput && activeInput.dataset.footnoteId;
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
      if (!nextInput) return;
      nextInput.focus({ preventScroll: true });
    });
  };

  update();
  return { update };
}

// Footnote UI on left sidebar
function FootnotePanel({ footnotes, refresh }) {
  if (!footnotes.length) return null;

  return (
    <section className="pm-footnote-panel">
      <h3 className="pm-footnote-panel__header">Footnotes</h3>
      {footnotes.map((footnote, index) => (
        <div className="pm-footnote" key={footnote.footnoteId}>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              focusPreviewFootnote(footnote.footnoteId);
            }}
          >
            {index + 1}
          </button>
          <FootnoteText footnote={footnote} refresh={refresh} />
        </div>
      ))}
    </section>
  );
}

// Individual footnote editor
function FootnoteText({ footnote }) {
  const ref = useRef(null);

  useEffect(() => {
    const sharedText = sharedFootnoteText(footnote);
    let cancelled = false;
    let observer = null;
    let view = null;

    if (cancelled || !ref.current) return;

    view = new EditorView(ref.current, {
      state: EditorState.create({
        doc: linkFootnoteDoc(footnoteDoc(sharedText.toString())),
        plugins: [history(), footnoteLinkPlugin(), footnoteKeymap(), keymap(baseKeymap)],
      }),
      dispatchTransaction(transaction) {
        view.updateState(view.state.apply(transaction));
        if (transaction.docChanged && !transaction.getMeta("footnoteLinkRefresh")) {
          updateSharedText(manuscriptSession.footnoteTexts, sharedText, footnoteText(view));

          const linkedDoc = linkFootnoteDoc(view.state.doc);
          if (!linkedDoc.eq(view.state.doc)) view.dispatch(view.state.tr
            .replaceWith(0, view.state.doc.content.size, linkedDoc.content)
            .setMeta("addToHistory", false)
            .setMeta("footnoteLinkRefresh", true));
        }
      },
      attributes: {
        "data-footnote-id": footnote.footnoteId,
      },
    });

    observer = () => {
      queueMicrotask(() => {
        if(cancelled) return;
        const nextText = sharedText.toString();
        if (nextText !== footnoteText(view)) {
          const selection = Math.min(view.state.selection.from, nextText.length + 1);
          const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, linkFootnoteDoc(footnoteDoc(nextText)).content);
          view.dispatch(tr
            .setSelection(TextSelection.create(tr.doc, selection))
            .setMeta("addToHistory", false));
        }
        updateFootnote(footnote.view, footnote.footnoteId, nextText);
      });
    };
    sharedText.observe(observer);
    observer();

    return () => {
      cancelled = true;
      if (observer) sharedText.unobserve(observer);
      if (view) view.destroy();
    };
  }, [footnote.footnoteId, footnote.view]);

  return <div className="pm-footnote-editor" ref={ref} />;
}

const footnoteTextSchema = new Schema({
  nodes: basicSchema.spec.nodes,
  marks: basicSchema.spec.marks,
});

function sharedFootnoteText(footnote) {
  const footnoteTexts = manuscriptSession.footnoteTexts;
  if (!footnoteTexts) return newSharedText(footnote.text);

  if (!(footnoteTexts.get(footnote.footnoteId) instanceof Y.Text)) {
    footnoteTexts.set(footnote.footnoteId, newSharedText(footnote.text));
  }
  return footnoteTexts.get(footnote.footnoteId);
}

function footnoteDoc(text) {
  return footnoteTextSchema.node("doc", null, [
    footnoteTextSchema.node("paragraph", null, text ? footnoteTextSchema.text(text) : null),
  ]);
}

function footnoteText(view) {
  return view.state.doc.textBetween(0, view.state.doc.content.size, "\n");
}

function footnoteKeymap() {
  return keymap({
    "Mod-z": undo,
    "Mod-Z": undo,
    "Mod-Shift-z": redo,
    "Mod-Shift-Z": redo,
  });
}

function footnoteLinkPlugin() {
  return new Plugin({
    props: {
      handleDOMEvents: {
        mousedown(_view, event) {
          const link = event.target.closest?.("a[href]");
          if (!link) return false;

          event.preventDefault();
          window.open(link.href, "_blank", "noopener,noreferrer");
          return true;
        },
      },
    },
  });
}

function linkFootnoteDoc(doc) {
  const linkMark = footnoteTextSchema.marks.link;
  let tr = null;

  doc.descendants((node, pos) => {
    if (!node.isText) return true;
    for (const match of node.text.matchAll(/\bhttps?:\/\/[^\s<]+/g)) {
      const from = pos + match.index;
      const to = from + match[0].length;
      tr = (tr || EditorState.create({ doc }).tr).addMark(from, to, linkMark.create({ href: match[0] }));
    }
    return true;
  });

  return tr ? tr.doc : doc;
}

function focusPreviewFootnote(footnoteId) {
  const shadowRoot = document.querySelector("[data-article-shadow]")?.shadowRoot;
  const footnote = shadowRoot?.querySelector(`[data-footnote-id="${cssEscape(footnoteId)}"][data-footnote-anchor="true"]`);
  if (!footnote) return;

  footnote.setAttribute("tabindex", "-1");
  footnote.scrollIntoView({ block: "center", inline: "nearest" });
  footnote.focus({ preventScroll: true });
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

// Zero width space, which is why footnotes don't highlight when you drag over them
// Originally used spaces but things got weird with spacing when footnotes got to double digits
// Still might be worth switching back to, if we can still use the ::before/::after cursor placement 
const FOOTNOTE_ANCHOR_TEXT = "\u200b";

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
  const targetView = view.streamSource ? view.streamSource.instance.view : view;
  const ranges = [];
  const footnoteMark = visitFootnoteMarks(targetView, ({ mark, from, to }) => {
    if (mark.attrs.footnoteId === footnoteId) ranges.push({ from, to, anchor: Boolean(mark.attrs.anchor) });
  });
  if (!footnoteMark || !ranges.length) return false;

  let tr = targetView.state.tr;
  for (const range of ranges) {
    tr = tr
      .removeMark(range.from, range.to, footnoteMark)
      .addMark(range.from, range.to, footnoteMark.create({ footnoteId, text, anchor: range.anchor }));
  }
  targetView.dispatch(tr);
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
