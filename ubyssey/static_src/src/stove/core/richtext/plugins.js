// RichText editor plugins

import "prosemirror-view/style/prosemirror.css";
import "prosemirror-gapcursor/style/gapcursor.css";
import "@guardian/prosemirror-invisibles/dist/style.css";

import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { baseKeymap, chainCommands, exitCode, joinDown, joinUp, lift, selectParentNode, setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { undo, redo, history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { ellipsis, emDash, inputRules, smartQuotes, textblockTypeInputRule, undoInputRule, wrappingInputRule } from "prosemirror-inputrules";
import { commentSuggestion, createSuggestionMark, markRangeAtCursor, startCommentCommand, startFootnoteCommand } from "./annotations/index.js";
import { promptLinkCommand } from "./link_dialog.jsx";
import { createInvisiblesPlugin, space as invisiblesSpace, hardBreak, paragraph as invisiblesParagraph } from "@guardian/prosemirror-invisibles/dist/index.mjs";

export const ARIAL_MODE_STORAGE_KEY = "manuscript-arial-mode";
export const INVISIBLE_CHARACTERS_STORAGE_KEY = "manuscript-invisible-characters";

export function isArialModeEnabled() {
  return window.localStorage.getItem(ARIAL_MODE_STORAGE_KEY) === "true";
}

export function areInvisibleCharactersEnabled() {
  return window.localStorage.getItem(INVISIBLE_CHARACTERS_STORAGE_KEY) === "true";
}

export function editorPlugins(schema, {includeHistory = true, undoCommand = undo, redoCommand = redo} = {}) {
  return [
    linkBubblePlugin(schema),
    activeCommentPlugin(schema),
    suggestionPlugin(schema),
    keymap(buildEditorKeymap(schema, { undoCommand, redoCommand })),
    keymap(baseKeymap),
    dropCursor(),
    gapCursor(),
    createInvisiblesPlugin([invisiblesSpace, hardBreak, invisiblesParagraph], { shouldShowInvisibles: areInvisibleCharactersEnabled() }),
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
  const suggestionMark = schema.marks.suggestion;
  const suggestionPart = (mark) => mark?.attrs?.suggestionPart || commentSuggestion(mark?.attrs?.comments);

  const createReplacementMarks = (replacedText, replacementText, threadId, existingMark = null) => {
    const existingComments = existingMark?.attrs?.comments;
    const deleteMark = createSuggestionMark(
      suggestionMark, "replace", replacedText, threadId, "delete", replacementText, existingComments,
    );
    const addMark = createSuggestionMark(
      suggestionMark, "replace", replacedText, deleteMark.attrs.threadId, "add", replacementText, existingComments,
    );
    return { deleteMark, addMark };
  };

  const threadRanges = (state, threadId, part = null) => {
    const ranges = [];
    state.doc.descendants((node, from) => {
      const mark = node.isText && suggestionMark.isInSet(node.marks);
      if (mark?.attrs?.threadId === threadId && (!part || suggestionPart(mark) === part)) {
        ranges.push({ from, to: from + node.nodeSize });
      }
      return true;
    });
    return ranges;
  };

  const sortRanges = (ranges) => [...ranges].sort((first, second) => first.from - second.from);
  const textInRanges = (doc, ranges) => sortRanges(ranges)
    .map(({ from, to }) => doc.textBetween(from, to, " "))
    .join("");

  const mapRanges = (tr, ranges) => ranges.map(({ from, to }) => ({
    from: tr.mapping.map(from, 1),
    to: tr.mapping.map(to, -1),
  })).filter(({ from, to }) => from < to);

  const applyMark = (tr, ranges, mark) => ranges.reduce(
    (nextTransaction, { from, to }) => nextTransaction
      .removeMark(from, to, suggestionMark)
      .addMark(from, to, mark),
    tr,
  );

  const applyAddition = (tr, existingMark, ranges) => {
    const addMark = createSuggestionMark(
      suggestionMark,
      "add",
      textInRanges(tr.doc, ranges),
      existingMark?.attrs?.threadId,
      null,
      null,
      existingMark?.attrs?.comments,
    );
    return applyMark(tr, ranges, addMark)
      .setMeta(ACTIVE_SUGGESTION_THREAD_META, addMark.attrs.threadId);
  };

  const applyReplacement = (tr, existingMark, deleteRanges, addRanges) => {
    const { deleteMark, addMark } = createReplacementMarks(
      textInRanges(tr.doc, deleteRanges),
      textInRanges(tr.doc, addRanges),
      existingMark?.attrs?.threadId,
      existingMark,
    );
    return applyMark(applyMark(tr, deleteRanges, deleteMark), addRanges, addMark)
      .setMeta(ACTIVE_SUGGESTION_THREAD_META, deleteMark.attrs.threadId);
  };

  const applyDeletion = (tr, existingMark, ranges) => {
    const deleteMark = createSuggestionMark(
      suggestionMark,
      "delete",
      textInRanges(tr.doc, ranges),
      existingMark?.attrs?.threadId,
      null,
      null,
      existingMark?.attrs?.comments,
    );
    return applyMark(tr, ranges, deleteMark)
      .setMeta(ACTIVE_SUGGESTION_THREAD_META, deleteMark.attrs.threadId);
  };

  const adjacentSuggestionMark = (state, from, to) => {
    const before = suggestionMark.isInSet(state.doc.resolve(from).nodeBefore?.marks || []);
    const after = suggestionMark.isInSet(state.doc.resolve(to).nodeAfter?.marks || []);
    const marks = [before, after].filter(Boolean);
    const threadIds = new Set(marks.map((mark) => mark.attrs.threadId));
    return threadIds.size === 1 ? marks[0] : null;
  };

  const rangeHasSuggestion = (state, from, to) => {
    let hasSuggestion = false;
    state.doc.nodesBetween(from, to, (node) => {
      if (node.isText && suggestionMark.isInSet(node.marks)) hasSuggestion = true;
      return !hasSuggestion;
    });
    return hasSuggestion;
  };

  const wordRangeWithAdjacentSpace = (state, from, to) => {
    const selectedText = state.doc.textBetween(from, to, "");
    if (!selectedText || /\s/.test(selectedText)) return { from, to, spacePosition: null };

    const $from = state.doc.resolve(from);
    const $to = state.doc.resolve(to);
    const trailingCharacter = $to.nodeAfter?.isText ? $to.nodeAfter.text.charAt(0) : "";
    const leadingCharacter = $from.nodeBefore?.isText ? $from.nodeBefore.text.slice(-1) : "";
    const isWordCharacter = (character) => /^[\p{L}\p{N}_]$/u.test(character);
    const isWholeWord = !isWordCharacter(leadingCharacter) && !isWordCharacter(trailingCharacter);
    if (!isWholeWord) return { from, to, spacePosition: null };

    if (trailingCharacter === " ") return { from, to: to + 1, spacePosition: "trailing" };
    if (leadingCharacter === " ") return { from: from - 1, to, spacePosition: "leading" };

    return null;
  };

  const replacementWithCapturedSpace = (text, spacePosition) => {
    if (spacePosition === "trailing") return `${text} `;
    if (spacePosition === "leading") return ` ${text}`;
    return text;
  };

  const insertIntoThread = (state, tr, mark, insertAt, text) => {
    const threadId = mark.attrs.threadId;
    const suggestion = commentSuggestion(mark.attrs.comments);
    tr = tr.insertText(text, insertAt);
    const insertedRange = { from: insertAt, to: insertAt + text.length };

    if (suggestion === "add") {
      return applyAddition(tr, mark, sortRanges([
        ...mapRanges(tr, threadRanges(state, threadId, "add")),
        insertedRange,
      ]));
    }

    if (suggestion === "delete") {
      return applyReplacement(
        tr,
        mark,
        mapRanges(tr, threadRanges(state, threadId, "delete")),
        [insertedRange],
      );
    }

    if (suggestion === "replace") {
      return applyReplacement(
        tr,
        mark,
        mapRanges(tr, threadRanges(state, threadId, "delete")),
        sortRanges([
          ...mapRanges(tr, threadRanges(state, threadId, "add")),
          insertedRange,
        ]),
      );
    }

    return null;
  };

  const mergeDeletionIntoThread = (state, tr, mark, from, to) => {
    const threadId = mark.attrs.threadId;
    const suggestion = commentSuggestion(mark.attrs.comments);

    if (suggestion === "add") {
      return applyReplacement(tr, mark, [{ from, to }], threadRanges(state, threadId, "add"));
    }

    if (suggestion === "delete") {
      return applyDeletion(tr, mark, sortRanges([
        ...threadRanges(state, threadId, "delete"),
        { from, to },
      ]));
    }

    if (suggestion === "replace") {
      return applyReplacement(
        tr,
        mark,
        sortRanges([
          ...threadRanges(state, threadId, "delete"),
          { from, to },
        ]),
        threadRanges(state, threadId, "add"),
      );
    }

    return null;
  };

  const rangeIsSuggestion = (state, from, to, suggestion) => {
    let foundText = false;
    let matches = true;
    state.doc.nodesBetween(from, to, (node) => {
      if (!node.isText) return true;
      foundText = true;
      if (suggestionPart(suggestionMark.isInSet(node.marks)) !== suggestion) matches = false;
      return true;
    });
    return foundText && matches;
  };

  const insertSuggestion = (view, from, to, text) => {
    if (!suggestionMode || !text) return false;

    const { state } = view;
    let tr = state.tr;
    if (from < to) {
      if (rangeHasSuggestion(state, from, to)) return false;

      const selectedRange = wordRangeWithAdjacentSpace(state, from, to);
      if (!selectedRange || rangeHasSuggestion(state, selectedRange.from, selectedRange.to)) return true;
      const replacementText = replacementWithCapturedSpace(text, selectedRange.spacePosition);

      const { deleteMark, addMark } = createReplacementMarks(
        state.doc.textBetween(selectedRange.from, selectedRange.to, " "),
        replacementText,
      );
      tr = tr.insertText(replacementText, selectedRange.to);
      tr = applyMark(tr, [{ from: selectedRange.from, to: selectedRange.to }], deleteMark);
      tr = applyMark(tr, [{
        from: selectedRange.to,
        to: selectedRange.to + replacementText.length,
      }], addMark)
        .setMeta(ACTIVE_SUGGESTION_THREAD_META, deleteMark.attrs.threadId);
      view.dispatch(tr.scrollIntoView());
      return true;
    }

    const nearbyMark = adjacentSuggestionMark(state, from, to);
    if (nearbyMark) {
      tr = insertIntoThread(state, tr, nearbyMark, from, text);
      if (tr) {
        view.dispatch(tr.scrollIntoView());
        return true;
      }
    }

    tr = tr.insertText(text, from);
    tr = applyAddition(tr, null, [{ from, to: from + text.length }]);
    view.dispatch(tr.scrollIntoView());
    return true;
  };

  // When you type next to a suggestion, it shouldn't be a suggestion if suggestion toggle off
  const insertPlainTextBesideSuggestion = (view, from, to, text) => {
    if (suggestionMode || from !== to || !text) return false;

    const { state } = view;
    const $from = state.doc.resolve(from);
    const isSuggestion = (node) => commentSuggestion(suggestionMark.isInSet(node?.marks || [])?.attrs?.comments);
    const beforeIsSuggestion = isSuggestion($from.nodeBefore);
    const afterIsSuggestion = isSuggestion($from.nodeAfter);
    if (beforeIsSuggestion === afterIsSuggestion) return false;
    const tr = state.tr
      .insertText(text, from, to)
      .removeMark(from, from + text.length, suggestionMark);
    view.dispatch(tr.scrollIntoView());
    return true;
  };

  return new Plugin({
    props: {
      handleTextInput(view, from, to, text) {
        return insertSuggestion(view, from, to, text) || insertPlainTextBesideSuggestion(view, from, to, text);
      },
      handleKeyDown(view, event) {
        if (!suggestionMode || !["Backspace", "Delete"].includes(event.key)) return false;

        const { state } = view;
        const { $from, empty } = state.selection;
        let { from, to } = state.selection;

        if (empty && event.key === "Backspace" && $from.parentOffset > 0) from -= 1;
        else if (empty && event.key === "Delete" && $from.parentOffset < $from.parent.content.size) to += 1;
        else if (empty) return false;

        if (!empty && !rangeHasSuggestion(state, from, to)) {
          const selectedRange = wordRangeWithAdjacentSpace(state, from, to);
          if (!selectedRange) {
            event.preventDefault();
            return true;
          }
          ({ from, to } = selectedRange);
        }
        event.preventDefault();

        let tr = state.tr;
        const removesAddition = rangeIsSuggestion(state, from, to, "add");
        if (removesAddition) {
          tr = tr.delete(from, to);
        } else if (!rangeHasSuggestion(state, from, to)) {
          const nearbyMark = adjacentSuggestionMark(state, from, to);
          tr = nearbyMark ? mergeDeletionIntoThread(state, tr, nearbyMark, from, to) : null;
          if (!tr) tr = applyDeletion(tr || state.tr, null, [{ from, to }]);
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
      const pageBlock = editorView.dom.closest("[data-article-block]");

      return {
        update(view) {
          const range = markRangeAtCursor(view.state, linkMark);
          const href = range?.attrs.href;
          if ((pageBlock && !pageBlock.classList.contains("pm-page-block--selected")) || !href || /^(javascript|data):/i.test(href)) {
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
  const suggestionMark = schema.marks.suggestion;
  return new Plugin({
    key: activeCommentPluginKey,
    state: {
      init: () => ({ threadId: null, decorations: DecorationSet.empty }),
      apply(transaction, value) {
        const nextThreadId = transaction.getMeta("activeCommentThread");
        const threadId = nextThreadId === undefined ? value.threadId : nextThreadId;
        if (!transaction.docChanged && threadId === value.threadId) return value;
        if (!threadId) return { threadId, decorations: DecorationSet.empty };

        const decorations = [];
        transaction.doc.descendants((node, position) => {
          if (!node.isText) return true;
          const mark = [commentMark, suggestionMark]
            .map((markType) => markType.isInSet(node.marks))
            .find((item) => item?.attrs.threadId === threadId);
          if (mark && !mark.attrs.resolved) {
            decorations.push(Decoration.inline(position, position + node.nodeSize, {
              "data-comment-active": "true",
              "data-suggestion-part": mark.attrs.suggestionPart || commentSuggestion(mark.attrs.comments) || "",
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
    bind("Mod-h", setBlockType(type, { level: 3 }));
    bind("Mod-Alt-3", setBlockType(type, { level: 3 }));
  }
  // Doesn't seem to work
  if ((type = schema.marks.comment)) {
    bind("Mod-Alt-m", startCommentCommand(type));
  }
  if ((type = schema.marks.footnote)) {
    bind("Mod-Alt-f", startFootnoteCommand(type));
  }
  bind("Mod-Alt-s", (state, dispatch) => {
    if (!dispatch) return true;
    toggleSuggestionMode();
    dispatch(state.tr.setMeta("suggestionModeChanged", suggestionMode));
    return true;
  });

  // Allows newlines without creating new block for RichText
  const hardBreak = schema.nodes.hard_break;
  if (hardBreak) {
    bind("Shift-Enter", chainCommands(exitCode, (state, dispatch) => {
      if (dispatch) dispatch(state.tr.replaceSelectionWith(hardBreak.create()).scrollIntoView());
      return true;
    }));
  }

  return keys;
}
