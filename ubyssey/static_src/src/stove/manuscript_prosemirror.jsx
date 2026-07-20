// Pure prosemirror stuff, like toolbar

import "prosemirror-view/style/prosemirror.css";
import "prosemirror-gapcursor/style/gapcursor.css";

// Lots of plugins
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Schema } from "prosemirror-model";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes, liftListItem, sinkListItem, splitListItem, wrapInList } from "prosemirror-schema-list";
import { baseKeymap, chainCommands, exitCode, joinDown, joinUp, lift, selectParentNode, setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { undo, redo, history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { ellipsis, emDash, inputRules, smartQuotes, textblockTypeInputRule, undoInputRule, wrappingInputRule } from "prosemirror-inputrules";
import { commentMarkSpec, commentSuggestion, createSuggestionMark, footnoteMarkSpec, markRangeAtCursor, startCommentCommand, startFootnoteCommand } from "./manuscript_annotations.jsx";

export const baseNodesWithLists = addListNodes(
  basicSchema.spec.nodes,
  "paragraph block*",
  "block",
);

export const marks = basicSchema.spec.marks.append({
  underline: {
    parseDOM: [
      { tag: "u" },
      {
        style: "text-decoration",
        getAttrs: (value) => String(value).includes("underline") ? null : false,
      },
    ],
    toDOM() {
      return ["u", 0];
    },
  },
  comment: commentMarkSpec,
  footnote: footnoteMarkSpec,
});

export const richTextSchema = new Schema({
  nodes: baseNodesWithLists,
  marks,
});

const isMac = typeof navigator !== "undefined" && /Mac|iP(hone|[oa]d)/.test(navigator.platform);

export function editorPlugins(schema) {
  return [
    linkBubblePlugin(schema),
    activeCommentPlugin(schema),
    suggestionPlugin(schema),
    buildEditorInputRules(schema),
    keymap(buildEditorKeymap(schema)),
    keymap(baseKeymap),
    dropCursor(),
    gapCursor(),
    history(),
  ];
}

let suggestionMode = false;
export const ACTIVE_SUGGESTION_THREAD_META = "activeSuggestionThread";

export function suggestionModeIsActive() {
  return suggestionMode;
}

export function toggleSuggestionMode() {
  suggestionMode = !suggestionMode;
  return suggestionMode;
}

function suggestionPlugin(schema) {
  const commentMark = schema.marks.comment;
  const suggestionPart = (mark) => mark?.attrs?.suggestionPart || commentSuggestion(mark?.attrs?.comments);

  const threadBounds = (state, threadId, part = null) => {
    let from = null;
    let to = null;
    state.doc.descendants((node, position) => {
      const mark = node.isText && commentMark.isInSet(node.marks);
      if (mark?.attrs?.threadId !== threadId || (part && suggestionPart(mark) !== part)) return true;
      from = from === null ? position : Math.min(from, position);
      to = Math.max(to || 0, position + node.nodeSize);
      return true;
    });
    return from === null ? null : { from, to };
  };

  const nearbyComments = (state, from, to) => [from, to].flatMap((position) => {
    const $position = state.doc.resolve(position);
    return [
      commentMark.isInSet($position.marks()),
      commentMark.isInSet($position.nodeBefore?.marks || []),
      commentMark.isInSet($position.nodeAfter?.marks || []),
    ];
  });

  const nearbySuggestion = (state, from, to, suggestion) => nearbyComments(state, from, to)
    .find((mark) => (
      suggestionPart(mark) === suggestion
      && commentSuggestion(mark.attrs.comments) === suggestion
    ));

  const markSuggestion = (state, tr, from, to, suggestion) => {
    const nearbyMark = nearbySuggestion(state, from, to, suggestion);
    const bounds = nearbyMark && threadBounds(state, nearbyMark.attrs.threadId);
    const markFrom = bounds ? Math.min(from, bounds.from) : from;
    const markTo = bounds ? Math.max(to, bounds.to) : to;
    const text = state.doc.textBetween(markFrom, markTo, " ");
    const mark = createSuggestionMark(commentMark, suggestion, text, nearbyMark?.attrs?.threadId);

    return tr
      .removeMark(markFrom, markTo, commentMark)
      .addMark(markFrom, markTo, mark)
      .setMeta(ACTIVE_SUGGESTION_THREAD_META, mark.attrs.threadId);
  };

  const rangeIsSuggestion = (state, from, to, suggestion) => {
    let foundText = false;
    let matches = true;
    state.doc.nodesBetween(from, to, (node) => {
      if (!node.isText) return true;
      foundText = true;
      if (suggestionPart(commentMark.isInSet(node.marks)) !== suggestion) matches = false;
      return true;
    });
    return foundText && matches;
  };

  const insertSuggestion = (view, from, to, text) => {
    if (!suggestionMode || !text) return false;

    const { state } = view;
    let tr = state.tr;
    const insertAt = from;

    if (from < to && !rangeIsSuggestion(state, from, to, "add")) {
      const replacedText = state.doc.textBetween(from, to, " ");
      const replacement = `${replacedText} → ${text}`;
      const deleteMark = createSuggestionMark(commentMark, "replace", replacement, undefined, "delete");
      const addMark = createSuggestionMark(commentMark, "replace", replacement, deleteMark.attrs.threadId, "add");

      tr = tr
        .removeMark(from, to, commentMark)
        .addMark(from, to, deleteMark)
        .insertText(text, to)
        .addMark(to, to + text.length, addMark)
        .setMeta(ACTIVE_SUGGESTION_THREAD_META, deleteMark.attrs.threadId);
      view.dispatch(tr.scrollIntoView());
      return true;
    }

    const replacementMark = from === to && nearbyComments(state, insertAt, insertAt)
      .find((mark) => suggestionPart(mark) === "add" && commentSuggestion(mark.attrs.comments) === "replace");

    if (replacementMark) {
      const threadId = replacementMark.attrs.threadId;
      const deleteBounds = threadBounds(state, threadId, "delete");
      const addBounds = threadBounds(state, threadId, "add");
      tr = tr.insertText(text, insertAt);

      const addFrom = Math.min(addBounds.from, insertAt);
      const addTo = Math.max(
        addBounds.to + (insertAt <= addBounds.to ? text.length : 0),
        insertAt + text.length,
      );
      const replacement = `${tr.doc.textBetween(deleteBounds.from, deleteBounds.to, " ")} → ${tr.doc.textBetween(addFrom, addTo, " ")}`;
      const deleteMark = createSuggestionMark(commentMark, "replace", replacement, threadId, "delete");
      const addMark = createSuggestionMark(commentMark, "replace", replacement, threadId, "add");

      tr = tr
        .removeMark(deleteBounds.from, deleteBounds.to, commentMark)
        .addMark(deleteBounds.from, deleteBounds.to, deleteMark)
        .removeMark(addFrom, addTo, commentMark)
        .addMark(addFrom, addTo, addMark)
        .setMeta(ACTIVE_SUGGESTION_THREAD_META, threadId);
      view.dispatch(tr.scrollIntoView());
      return true;
    }

    if (from < to) tr = tr.delete(from, to);

    const nearbyMark = from < to ? null : nearbySuggestion(state, insertAt, insertAt, "add");
    const bounds = nearbyMark && threadBounds(state, nearbyMark.attrs.threadId);
    tr = tr.insertText(text, insertAt);

    const markFrom = bounds ? Math.min(bounds.from, insertAt) : insertAt;
    const markTo = bounds
      ? Math.max(bounds.to + (insertAt <= bounds.to ? text.length : 0), insertAt + text.length)
      : insertAt + text.length;
    const addedText = tr.doc.textBetween(markFrom, markTo, " ");
    const addMark = createSuggestionMark(commentMark, "add", addedText, nearbyMark?.attrs?.threadId);

    tr = tr
      .removeMark(markFrom, markTo, commentMark)
      .addMark(markFrom, markTo, addMark)
      .setMeta(ACTIVE_SUGGESTION_THREAD_META, addMark.attrs.threadId);
    view.dispatch(tr.scrollIntoView());
    return true;
  };

  return new Plugin({
    props: {
      handleTextInput: insertSuggestion,
      handleKeyDown(view, event) {
        if (!suggestionMode || !["Backspace", "Delete"].includes(event.key)) return false;

        const { state } = view;
        const { $from, empty } = state.selection;
        let { from, to } = state.selection;

        if (empty && event.key === "Backspace" && $from.parentOffset > 0) from -= 1;
        else if (empty && event.key === "Delete" && $from.parentOffset < $from.parent.content.size) to += 1;
        else if (empty) return false;
        event.preventDefault();

        let tr = state.tr;
        const removesAddition = rangeIsSuggestion(state, from, to, "add");
        if (removesAddition) {
          tr = tr.delete(from, to);
        } else if (!rangeIsSuggestion(state, from, to, "delete")) {
          tr = markSuggestion(state, tr, from, to, "delete");
        }

        const cursor = Math.min(event.key === "Delete" && empty && !removesAddition ? to : from, tr.doc.content.size);
        view.dispatch(tr.setSelection(TextSelection.create(tr.doc, cursor)).scrollIntoView());
        return true;
      },
    },
  });
}

function linkBubblePlugin(schema) {
  const linkMark = schema.marks.link;
  const linkFromEvent = (event) => event.target.closest?.("a[href]");
  return new Plugin({
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          const clickedLink = linkFromEvent(event);
          if (!clickedLink) return false;

          event.preventDefault();
          const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.posAtDOM(clickedLink, 0);
          view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(position))));
          view.focus();
          return true;
        },
        click(_, event) {
          if (!linkFromEvent(event)) return false;
          event.preventDefault();
          return true;
        },
      },
    },
    view(editorView) {
      const bubble = document.createElement("div");
      const link = document.createElement("a");
      
      bubble.className = "pm-link-bubble";
      bubble.hidden = true;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      bubble.appendChild(link);
      editorView.dom.parentNode.appendChild(bubble);
      return {
        update(view) {
          const range = markRangeAtCursor(view.state, linkMark);
          const href = range?.attrs.href;
          if (!href || /^(javascript|data):/i.test(href)) {
            bubble.hidden = true;
            return;
          }
          link.href = href;
          link.textContent = href;
          bubble.hidden = false;
          const start = view.coordsAtPos(range.from);
          const end = view.coordsAtPos(range.to);
          const offset = bubble.offsetParent.getBoundingClientRect();
          bubble.style.left = `${(start.left + end.right) / 2 - offset.left}px`;
          bubble.style.top = `${Math.min(start.top, end.top) - offset.top}px`;
        },
        destroy() {
          bubble.remove();
        },
      };
    },
  });
}

// Highlights currently active comment thread text - maybe overkill but fixed annoying synchronization issue
const activeCommentPluginKey = new PluginKey("activeComment");
function activeCommentPlugin(schema) {
  const commentMark = schema.marks.comment;
  return new Plugin({
    key: activeCommentPluginKey,
    state: {
      init: () => ({ threadId: null, decorations: DecorationSet.empty }),
      apply(transaction, value) {
        const nextThreadId = transaction.getMeta("activeCommentThread");
        const threadId = nextThreadId === undefined ? value.threadId : nextThreadId;
        if (!transaction.docChanged && threadId === value.threadId) return value;
        if (!commentMark || !threadId) return { threadId, decorations: DecorationSet.empty };

        const decorations = [];
        transaction.doc.descendants((node, position) => {
          if (!node.isText) return true;
          const mark = commentMark.isInSet(node.marks);
          if (mark?.attrs.threadId === threadId) {
            decorations.push(Decoration.inline(position, position + node.nodeSize, {
              "data-comment-active": "true",
              "data-comment-suggestion": mark.attrs.suggestionPart || commentSuggestion(mark.attrs.comments) || "",
            }));
          }
          return true;
        });
        return { threadId, decorations: DecorationSet.create(transaction.doc, decorations) };
      },
    },
    props: {
      decorations: (state) => activeCommentPluginKey.getState(state).decorations,
    },
  });
}

function buildEditorKeymap(schema) {
  const keys = {};
  const bind = (key, command) => { keys[key] = command; };
  let type;

  // Mod is platform agnostic ctrl/cmd
  bind("Mod-z", undo);
  bind("Shift-Mod-z", redo);
  bind("Backspace", undoInputRule);
  if (!isMac) bind("Mod-y", redo);
  bind("Alt-ArrowUp", joinUp);
  bind("Alt-ArrowDown", joinDown);
  bind("Mod-BracketLeft", lift);
  bind("Escape", selectParentNode);

  if ((type = schema.marks.strong)) {
    bind("Mod-b", toggleMark(type));
    bind("Mod-B", toggleMark(type));
  }
  if ((type = schema.marks.em)) {
    bind("Mod-i", toggleMark(type));
    bind("Mod-I", toggleMark(type));
  }
  if ((type = schema.marks.code)) bind("Mod-`", toggleMark(type));
  if ((type = schema.marks.underline)) {
    bind("Mod-u", toggleMark(type));
    bind("Mod-U", toggleMark(type));
  }
  if ((type = schema.marks.link)) bind("Mod-k", promptLinkCommand(type));
  if ((type = schema.nodes.bullet_list)) bind("Shift-Ctrl-8", wrapInList(type));
  if ((type = schema.nodes.ordered_list)) bind("Shift-Ctrl-9", wrapInList(type));
  if ((type = schema.nodes.blockquote)) bind("Ctrl->", wrapIn(type));
  if ((type = schema.nodes.hard_break)) {
    const br = type;
    const insertBreak = chainCommands(exitCode, (state, dispatch) => {
      if (dispatch) dispatch(state.tr.replaceSelectionWith(br.create()).scrollIntoView());
      return true;
    });
    bind("Mod-Enter", insertBreak);
    bind("Shift-Enter", insertBreak);
    if (isMac) bind("Ctrl-Enter", insertBreak);
  }
  if ((type = schema.nodes.list_item)) {
    bind("Enter", splitListItem(type));
    bind("Mod-[", liftListItem(type));
    bind("Mod-]", sinkListItem(type));
  }
  if ((type = schema.nodes.paragraph)) bind("Shift-Ctrl-0", setBlockType(type));
  if ((type = schema.nodes.code_block)) bind("Shift-Ctrl-\\", setBlockType(type));
  if ((type = schema.nodes.heading)) {
    for (let level = 1; level <= 6; level += 1) bind(`Shift-Ctrl-${level}`, setBlockType(type, { level }));
  }
  if ((type = schema.nodes.horizontal_rule)) {
    const hr = type;
    bind("Mod-_", (state, dispatch) => {
      if (dispatch) dispatch(state.tr.replaceSelectionWith(hr.create()).scrollIntoView());
      return true;
    });
  }

  return keys;
}

function buildEditorInputRules(schema) {
  const rules = [...smartQuotes, ellipsis, emDash];
  let type;

  if ((type = schema.nodes.blockquote)) rules.push(wrappingInputRule(/^\s*>\s$/, type));
  if ((type = schema.nodes.ordered_list)) {
    rules.push(wrappingInputRule(
      /^(\d+)\.\s$/,
      type,
      (match) => ({ order: Number(match[1]) }),
      (match, node) => node.childCount + node.attrs.order === Number(match[1]),
    ));
  }
  if ((type = schema.nodes.bullet_list)) rules.push(wrappingInputRule(/^\s*([-+*])\s$/, type));
  if ((type = schema.nodes.code_block)) rules.push(textblockTypeInputRule(/^```$/, type));
  if ((type = schema.nodes.heading)) {
    rules.push(textblockTypeInputRule(/^(#{1,6})\s$/, type, (match) => ({ level: match[1].length })));
  }

  return inputRules({ rules });
}

const TOOLBAR_ITEMS = [
  ["undo", "↶", "Undo"],
  ["redo", "↷", "Redo"],
  ["bold", "B", "Bold"],
  ["italic", "I", "Italic"],
  ["underline", "U", "Underline"],
  ["heading3", "h3", "Heading 3"],
  ["link", "Link", "Insert link"],
  ["bulletList", "•", "Bullet list"],
  ["orderedList", "1.", "Ordered list"],
  ["comment", "💬", "Comment"],
  ["suggestionMode", "Suggest", "Toggle suggestion mode"],
  ["footnote", "*", "Footnote"],
];

export function createEditorToolbar(root, { view = null, publishSource = null, onHistoryCommand = () => {} } = {}) {
  if (!root) return null;

  let activeView = view;
  let historyView = view;
  const reactRoot = createRoot(root);

  function update() {
    reactRoot.render(
      <EditorToolbar
        view={activeView}
        historyView={historyView}
        publishSource={publishSource}
        onHistoryCommand={onHistoryCommand}
        refresh={update}
      />,
    );
  }

  function runHistory(key) {
    const command = historyView && toolbarCommand(historyView, key);
    if (!command || !command(historyView.state, historyView.dispatch, historyView)) return false;

    if (historyView === activeView) activeView.focus();
    onHistoryCommand();
    update();
    return true;
  }

  update();
  return {
    setView(nextView) {
      if (!nextView && historyView === activeView) historyView = null;
      activeView = nextView;
      if (nextView) historyView = nextView;
      update();
    },
    setHistoryView(nextView) {
      historyView = nextView;
      update();
    },
    runHistory,
    update,
  };
}

function EditorToolbar({ view, historyView, publishSource, onHistoryCommand, refresh }) {
  return (
    <div className={`pm-editor-toolbar${publishSource ? " pm-editor-toolbar--article" : ""}`}>
      <div className="pm-editor-toolbar__tools">
        {TOOLBAR_ITEMS.map(([key, label, title]) => {
          const isHistoryCommand = ["undo", "redo"].includes(key);
          const commandView = isHistoryCommand ? historyView : view;
          const command = commandView && toolbarCommand(commandView, key);
          const enabled = Boolean(command && command(commandView.state));
          const active = view ? toolbarItemIsActive(view, key) : false;

          return (
            <button
              key={key}
              type="button"
              className={`pm-editor-toolbar__button pm-editor-toolbar__button--${key}`}
              title={title}
              aria-label={title}
              aria-pressed={String(active)}
              disabled={!enabled}
              onMouseDown={(event) => { event.preventDefault(); }}
              onClick={() => {
                if (command(commandView.state, commandView.dispatch, commandView)) {
                  if (commandView === view) view.focus();
                  if (isHistoryCommand) onHistoryCommand();
                  refresh();
                }
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {publishSource && <PublishToolbar source={publishSource} />}
    </div>
  );
}

function toolbarItemIsActive(view, key) {
  const { state } = view;
  if (key === "suggestionMode") return suggestionModeIsActive();
  const markNames = { bold: "strong", italic: "em", underline: "underline", link: "link", comment: "comment", footnote: "footnote" };
  const headingLevels = { heading3: 3 };
  const headingLevel = headingLevels[key];
  const listNames = { bulletList: "bullet_list", orderedList: "ordered_list" };
  const mark = state.schema.marks[markNames[key]];
  const nodeType = headingLevel ? state.schema.nodes.heading : state.schema.nodes[listNames[key]];

  if (mark) {
    const { from, $from, to, empty } = state.selection;
    if (empty) {
      return Boolean(key === "footnote" ? markRangeAtCursor(state, mark) : mark.isInSet(state.storedMarks || $from.marks()));
    }
    if (key === "footnote" || key === "link") return false;
    return state.doc.rangeHasMark(from, to, mark);
  }

  if (!nodeType) return false;

  const { from, $from, to } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type === nodeType) return headingLevel ? node.attrs.level === headingLevel : true;
  }

  let active = false;
  if (to > from) {
    state.doc.nodesBetween(from, to, (node) => {
      if (node.type !== nodeType) return true;
      if (headingLevel && node.attrs.level !== headingLevel) return true;
      active = true;
      return false;
    });
  }
  return active;
}

function PublishToolbar({ source }) {
  const status = source.querySelector("[data-article-status]");
  const published = source.querySelector("[data-article-published]");
  const liveLink = source.querySelector("[data-article-live-link]");
  const draftButton = source.querySelector('[data-article-action="draft"]');
  const publishButton = source.querySelector('[data-article-action="publish"]');

  return (
    <div className="pm-editor-toolbar__publish">
      {status && <span className="pm-editor-toolbar__meta">{status.textContent.trim()}</span>}
      {published && <span className="pm-editor-toolbar__meta">{published.textContent.trim()}</span>}
      {liveLink && liveLink.href && (
        <a className="pm-editor-toolbar__link" href={liveLink.href} target="_blank" rel="noopener">
          {liveLink.textContent.trim() || "View Live"}
        </a>
      )}
      {[ ["draft", draftButton], ["publish", publishButton] ].map(([action, sourceButton]) => (
        sourceButton && (
          <button
            key={action}
            type="button"
            className={`pm-editor-toolbar__action pm-editor-toolbar__action--${action}`}
            onClick={() => {
              if (sourceButton.form.requestSubmit) sourceButton.form.requestSubmit(sourceButton);
              else sourceButton.click();
            }}
          >
            {sourceButton.textContent.trim()}
          </button>
        )
      ))}
    </div>
  );
}

function promptLinkCommand(linkMark) {
  return (state, dispatch, view) => {
    if (!state.selection.empty) return false;
    if (!dispatch || !view) return true;

    const range = markRangeAtCursor(state, linkMark);
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

function toolbarCommand(view, key) {
  const { schema } = view.state;
  const commands = {
    suggestionMode: (state, dispatch) => {
      if (dispatch) toggleSuggestionMode();
      return true;
    },
    undo,
    redo,
    bold: schema.marks.strong && toggleMark(schema.marks.strong),
    italic: schema.marks.em && toggleMark(schema.marks.em),
    underline: schema.marks.underline && toggleMark(schema.marks.underline),
    // setBlockType is a Prosemirror function and is unrelated to wagtail blocks
    heading3: schema.nodes.heading && schema.nodes.paragraph && (toolbarItemIsActive(view, "heading3")
      ? setBlockType(schema.nodes.paragraph)
      : setBlockType(schema.nodes.heading, { level: 3 })),
    link: schema.marks.link && promptLinkCommand(schema.marks.link),
    bulletList: schema.nodes.bullet_list && wrapInList(schema.nodes.bullet_list),
    orderedList: schema.nodes.ordered_list && wrapInList(schema.nodes.ordered_list),
    comment: schema.marks.comment && startCommentCommand(schema.marks.comment),
    footnote: schema.marks.footnote && startFootnoteCommand(schema.marks.footnote),
  };
  return commands[key] || null;
}
