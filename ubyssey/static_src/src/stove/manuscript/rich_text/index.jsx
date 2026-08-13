// Prosemirror stuff

// Also contains keybinds - confer with Spencer

// Plugin docs here - https://prosemirror.net/docs/ref/#state.Plugin_System

import "prosemirror-view/style/prosemirror.css";
import "prosemirror-gapcursor/style/gapcursor.css";

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
import { commentMarkSpec, commentSuggestion, createSuggestionMark, footnoteMarkSpec, markRangeAtCursor } from "../annotations/index.js";
import { promptLinkCommand } from "./link_dialog.jsx";

// Change here buildEditorKeymap for actual functionality
const shortcutDefinitions = [
  { label: "Undo", key: "Mod-z" },
  { label: "Redo", key: "Mod-Shift-z" },
  { label: "Bold", key: "Mod-b" },
  { label: "Italic", key: "Mod-i" },
  { label: "Underline", key: "Mod-u" },
  { label: "Insert Link", key: "Mod-k" },
];

// Todo don't be lazy
const container = document.getElementById("guide-container");
const root = createRoot(container);

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

export function editorPlugins(schema, {
  includeHistory = true,
  undoCommand = undo,
  redoCommand = redo,
} = {}) {
  return [
    linkBubblePlugin(schema),
    activeCommentPlugin(schema),
    suggestionPlugin(schema),
    keymap(buildEditorKeymap(schema, { undoCommand, redoCommand })),
    keymap(baseKeymap),
    dropCursor(),
    gapCursor(),
    ...(includeHistory ? [history()] : []),
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

function buildEditorKeymap(schema, { undoCommand, redoCommand }) {
  const keys = {};
  const bind = (key, command) => { keys[key] = command; };
  let type;

  // Mod is platform agnostic ctrl/cmd
  bind("Mod-z", undoCommand);
  bind("Shift-Mod-z", redoCommand);
  bind("Backspace", undoInputRule);

  if ((type = schema.marks.strong)) {
    bind("Mod-b", toggleMark(type));
    bind("Mod-B", toggleMark(type));
  }
  if ((type = schema.marks.em)) {
    bind("Mod-i", toggleMark(type));
    bind("Mod-I", toggleMark(type));
  }
  if ((type = schema.marks.underline)) {
    bind("Mod-u", toggleMark(type));
    bind("Mod-U", toggleMark(type));
  }
  if ((type = schema.marks.link)) bind("Mod-k", promptLinkCommand(type));
  if ((type = schema.nodes.heading)) {
      bind("Mod-h", setBlockType(schema.nodes.heading, { level: 3 }));
  }
  // Allows newlines without creating new block for RichText
  const hardBreak = schema.nodes.hard_break;
  if (hardBreak) {
    bind("Shift-Enter", chainCommands(exitCode, (state, dispatch) => {
      if (dispatch) dispatch(state.tr.replaceSelectionWith(hardBreak.create()).scrollIntoView());
      return true;
    }));
  }

  root.render(<ShortcutDocumentation/>)

  return keys;
}

function ShortcutDocumentation() {
  const modifierKeyPrefix =
  navigator.platform.startsWith("Mac") || navigator.platform === "iPhone"
    ? "⌘" // command key
    : "Ctrl"; // control key

  return <div className="shortcut-documentation">
    <h3>Shortcuts</h3>
    <ul>
      {shortcutDefinitions.map((shortcut, index) => {
        const formattedKey = shortcut.key.replace("Mod", modifierKeyPrefix)
        return (
          <li key={index}><b>{ shortcut.label }:</b> { formattedKey }</li>
        )
      })}
    </ul>
  </div>
}
