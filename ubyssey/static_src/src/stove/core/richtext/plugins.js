// RichText editor plugins

import "prosemirror-view/style/prosemirror.css";
import "prosemirror-gapcursor/style/gapcursor.css";
import "@guardian/prosemirror-invisibles/dist/style.css";

import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Slice } from "prosemirror-model";
import { Decoration, DecorationSet } from "prosemirror-view";
import { baseKeymap, chainCommands, exitCode, joinDown, joinUp, lift, selectParentNode, setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { undo, redo, history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { ellipsis, emDash, inputRules, smartQuotes, textblockTypeInputRule, undoInputRule, wrappingInputRule } from "prosemirror-inputrules";
import { createInvisiblesPlugin, space as invisiblesSpace, hardBreak, paragraph as invisiblesParagraph } from "@guardian/prosemirror-invisibles/dist/index.mjs";
import { ySyncPluginKey } from "y-prosemirror";
import { v4 as uuidv4 } from "uuid";

import { commentSuggestion, createSuggestionMark, markRangeAtCursor, startCommentCommand, startFootnoteCommand } from "./annotations/index.js";
import { promptLinkCommand } from "./link_dialog.jsx";
import { ACTIVE_SUGGESTION_THREAD_META, suggestionModeIsActive, toggleSuggestionMode } from "./suggestion_mode.js";
import { pageEditorState } from "../state.js";

export { ACTIVE_SUGGESTION_THREAD_META, suggestionModeIsActive, toggleSuggestionMode } from "./suggestion_mode.js";

export const ARIAL_MODE_STORAGE_KEY = "manuscript-arial-mode";
export const INVISIBLE_CHARACTERS_STORAGE_KEY = "manuscript-invisible-characters";

export function isArialModeEnabled() {
  return window.localStorage.getItem(ARIAL_MODE_STORAGE_KEY) === "true";
}

export function areInvisibleCharactersEnabled() {
  return window.localStorage.getItem(INVISIBLE_CHARACTERS_STORAGE_KEY) === "true";
}

export function editorPlugins(schema, {includeHistory = true, undoCommand = undo, redoCommand = redo, allowAnnotations = true} = {}) {
  return [
    linkBubblePlugin(schema),
    // Disabling for now, I don't have time to polish
    //selectionCommentBubblePlugin(schema),
    ...(allowAnnotations ? [activeCommentPlugin(schema), footnoteSelectionPlugin(schema), footnotePastePlugin(schema), frozenFootnotePlugin(schema), suggestionPlugin(schema)] : []),
    keymap(buildEditorKeymap(schema, { undoCommand, redoCommand, allowAnnotations })),
    keymap(baseKeymap),
    dropCursor(),
    gapCursor(),
    createInvisiblesPlugin([invisiblesSpace, hardBreak, invisiblesParagraph], { shouldShowInvisibles: areInvisibleCharactersEnabled() }),
    ...(includeHistory ? [history()] : []),
  ];
}

function suggestionPlugin(schema) {
  const commentMark = schema.marks.comment;
  const suggestionMark = schema.marks.suggestion;
  const footnoteMark = schema.marks.footnote;
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

  const adjacentSuggestionMark = (state, from, to, { preferBefore = false } = {}) => {
    const before = suggestionMark.isInSet(state.doc.resolve(from).nodeBefore?.marks || []);
    const after = suggestionMark.isInSet(state.doc.resolve(to).nodeAfter?.marks || []);
    if (preferBefore) return before || after;

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

  const deleteRangeWithSuggestions = (state, from, to) => {
    const segments = [];
    state.doc.nodesBetween(from, to, (node, position) => {
      if (!node.isText) return true;
      const segmentFrom = Math.max(from, position);
      const segmentTo = Math.min(to, position + node.nodeSize);
      if (segmentFrom >= segmentTo) return true;

      const footnote = footnoteMark?.isInSet(node.marks);
      if (pageEditorState.footnotesFrozen && footnote?.attrs.anchor) return true;

      const mark = suggestionMark.isInSet(node.marks);
      const comment = commentMark?.isInSet(node.marks);
      const part = suggestionPart(mark);
      segments.push({
        from: segmentFrom,
        to: segmentTo,
        comment,
        mark,
        physicallyDelete: part === "add" && !comment,
        needsDeletionMark: !mark || (part === "add" && Boolean(comment)),
      });
      return true;
    });

    let tr = state.tr;
    for (const segment of segments
      .filter(({ physicallyDelete }) => physicallyDelete)
      .sort((first, second) => second.from - first.from)) {
      tr = tr.delete(segment.from, segment.to);
    }

    const rangesToMark = mapRanges(
      tr,
      segments.filter(({ needsDeletionMark }) => needsDeletionMark),
    );
    if (!rangesToMark.length) return tr;

    const existingMark = segments.find(({ needsDeletionMark, mark }) => (
      needsDeletionMark && mark && suggestionPart(mark) === "add"
    ))?.mark;
    const nearbyMark = adjacentSuggestionMark(
      { doc: tr.doc },
      rangesToMark[0].from,
      rangesToMark[rangesToMark.length - 1].to,
      { preferBefore: true },
    );

    const mergeMark = existingMark || nearbyMark;
    if (
      mergeMark
      && suggestionPart(mergeMark) === "add"
      && commentSuggestion(mergeMark.attrs.comments) === "add"
    ) {
      return applyReplacement(
        tr,
        mergeMark,
        rangesToMark,
        mapRanges(tr, threadRanges(state, mergeMark.attrs.threadId, "add")),
      );
    }

    return applyDeletion(tr, mergeMark, rangesToMark);
  };

  const mergeAdjacentDeletionThreads = (tr, activeThreadId) => {
    if (!activeThreadId) return tr;
    let ownerThreadId = activeThreadId;

    const isSimpleDeletion = (mark) => mark
      && suggestionPart(mark) === "delete"
      && commentSuggestion(mark.attrs.comments) === "delete";

    while (true) {
      let previous = null;
      let pair = null;
      tr.doc.descendants((node, position) => {
        if (!node.isText) {
          previous = null;
          return true;
        }

        const mark = suggestionMark.isInSet(node.marks);
        if (!pair && previous && previous.to === position
          && previous.mark && mark
          && previous.mark.attrs.threadId !== mark.attrs.threadId
          && [previous.mark.attrs.threadId, mark.attrs.threadId].includes(ownerThreadId)
          && isSimpleDeletion(previous.mark)
          && isSimpleDeletion(mark)) {
          pair = { left: previous.mark, right: mark };
        }
        previous = { from: position, to: position + node.nodeSize, mark };
        return true;
      });

      if (!pair) return tr;

      const ranges = [];
      tr.doc.descendants((node, position) => {
        if (!node.isText) return true;
        const mark = suggestionMark.isInSet(node.marks);
        if ([pair.left.attrs.threadId, pair.right.attrs.threadId].includes(mark?.attrs?.threadId)) {
          ranges.push({ from: position, to: position + node.nodeSize });
        }
        return true;
      });
      const mergedMark = suggestionMark.create({
        ...pair.left.attrs,
        comments: [
          ...(Array.isArray(pair.left.attrs.comments) ? pair.left.attrs.comments : []),
          ...(Array.isArray(pair.right.attrs.comments) ? pair.right.attrs.comments : []),
        ],
      });
      tr = applyDeletion(tr, mergedMark, ranges);
      ownerThreadId = pair.left.attrs.threadId;
    }
  };

  const insertSuggestion = (view, from, to, text) => {
    if (!suggestionModeIsActive() || !text) return false;

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
        .setSelection(TextSelection.create(tr.doc, selectedRange.to + replacementText.length))
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

  const pasteSuggestionIntoPreexistingThread = (state, tr, mark, pastedRanges) => {
    const threadId = mark.attrs.threadId;
    const suggestion = commentSuggestion(mark.attrs.comments);

    if (suggestion === "add") {
      return applyAddition(tr, mark, sortRanges([
        ...mapRanges(tr, threadRanges(state, threadId, "add")),
        ...pastedRanges,
      ]));
    }

    if (suggestion === "delete") {
      return applyReplacement(
        tr,
        mark,
        mapRanges(tr, threadRanges(state, threadId, "delete")),
        pastedRanges,
      );
    }

    if (suggestion === "replace") {
      return applyReplacement(
        tr,
        mark,
        mapRanges(tr, threadRanges(state, threadId, "delete")),
        sortRanges([
          ...mapRanges(tr, threadRanges(state, threadId, "add")),
          ...pastedRanges,
        ]),
      );
    }

    return applyAddition(tr, null, pastedRanges);
  };

  const pasteSuggestion = (view, slice) => {
    if (!suggestionModeIsActive() || !slice.content.size) return false;

    const { state } = view;
    const { from, to, empty } = state.selection;
    if (!(state.selection instanceof TextSelection)) return false;
    if (!empty && rangeHasSuggestion(state, from, to)) return false;

    const selectedRange = empty ? null : wordRangeWithAdjacentSpace(state, from, to) || { from, to, spacePosition: null };
    if (selectedRange && rangeHasSuggestion(state, selectedRange.from, selectedRange.to)) return false;

    const canCaptureSpace = selectedRange?.spacePosition
      && slice.openStart === 0
      && slice.openEnd === 0
      && slice.content.childCount === 1
      && slice.content.firstChild.isText;
    const insertAt = selectedRange?.to ?? from;
    let tr = state.tr;

    if (canCaptureSpace && selectedRange.spacePosition === "leading") tr = tr.insertText(" ", insertAt);
    const sliceInsertAt = canCaptureSpace && selectedRange.spacePosition === "leading" ? tr.mapping.map(insertAt, 1) : insertAt;
    tr = tr.replaceRange(sliceInsertAt, sliceInsertAt, slice);

    const pastedFrom = tr.mapping.map(insertAt, -1);
    let pastedTo = tr.mapping.map(insertAt, 1);
    if (canCaptureSpace && selectedRange.spacePosition === "trailing") {
      tr = tr.insertText(" ", pastedTo);
      pastedTo += 1;
    }

    const pastedRanges = pastedFrom < pastedTo ? [{ from: pastedFrom, to: pastedTo }] : [];
    if (!pastedRanges.length || !textInRanges(tr.doc, pastedRanges)) return false;

    if (selectedRange) {
      const deletedFrom = tr.mapping.map(selectedRange.from, -1);
      const deletedTo = tr.mapping.map(selectedRange.to, -1);
      const { deleteMark, addMark } = createReplacementMarks(
        state.doc.textBetween(selectedRange.from, selectedRange.to, " "),
        textInRanges(tr.doc, pastedRanges),
      );
      tr = applyMark(tr, [{ from: deletedFrom, to: deletedTo }], deleteMark);
      tr = applyMark(tr, pastedRanges, addMark).setMeta(ACTIVE_SUGGESTION_THREAD_META, deleteMark.attrs.threadId);
    } else {
      const nearbyMark = adjacentSuggestionMark(state, from, to);
      tr = nearbyMark
        ? pasteSuggestionIntoPreexistingThread(state, tr, nearbyMark, pastedRanges)
        : applyAddition(tr, null, pastedRanges);
    }

    view.dispatch(tr
      .setSelection(TextSelection.near(tr.doc.resolve(Math.min(pastedTo, tr.doc.content.size))))
      .setMeta("paste", true)
      .setMeta("uiEvent", "paste")
      .scrollIntoView());
    return true;
  };

  const cutAsSuggestion = (view, from, to, { cursorAfterDeletion = false } = {}) => {
    const { state } = view;
    const removesAddition = rangeIsSuggestion(state, from, to, "add");
    let tr = deleteRangeWithSuggestions(state, from, to);
    tr = mergeAdjacentDeletionThreads(tr, tr.getMeta(ACTIVE_SUGGESTION_THREAD_META));

    const cursor = Math.min(cursorAfterDeletion && !removesAddition ? to : from, tr.doc.content.size);
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, cursor)).scrollIntoView());
    return true;
  };

  // When you type next to a suggestion, it shouldn't be a suggestion if suggestion toggle off
  const insertPlainTextBesideSuggestion = (view, from, to, text) => {
    if (suggestionModeIsActive() || from !== to || !text) return false;

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
      handlePaste(view, _event, slice) {
        return pasteSuggestion(view, slice);
      },
      handleDOMEvents: {
        cut(view, event) {
          if (!suggestionModeIsActive() || view.state.selection.empty || !event.clipboardData) return false;

          const { dom, text } = view.serializeForClipboard(view.state.selection.content());
          event.preventDefault();
          event.clipboardData.clearData();
          event.clipboardData.setData("text/html", dom.innerHTML);
          event.clipboardData.setData("text/plain", text);

          const { state } = view;
          let { from, to } = state.selection;
          if (!rangeHasSuggestion(state, from, to)) {
            const selectedRange = wordRangeWithAdjacentSpace(state, from, to);
            if (!selectedRange) return true;
            ({ from, to } = selectedRange);
          }
          return cutAsSuggestion(view, from, to);
        },
      },
      handleKeyDown(view, event) {
        if (!suggestionModeIsActive() || !["Backspace", "Delete"].includes(event.key)) return false;

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

        return cutAsSuggestion(view, from, to, { cursorAfterDeletion: event.key === "Delete" && empty });
      },
    },
  });
}

function selectionCommentBubblePlugin(schema) {
  const commentMark = schema.marks.comment;
  if (!commentMark) return new Plugin({});

  return new Plugin({
    view(editorView) {
      const bubble = document.createElement("div");
      const button = document.createElement("button");
      bubble.className = "pm-selection-comment-bubble";
      bubble.hidden = true;
      button.type = "button";
      button.textContent = "Comment";
      bubble.appendChild(button);
      editorView.dom.parentNode.appendChild(bubble);

      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        startCommentCommand(commentMark)(editorView.state, editorView.dispatch, editorView);
        editorView.focus();
      });

      return {
        update(view) {
          const { selection } = view.state;
          if (!(selection instanceof TextSelection) || selection.empty) {
            bubble.hidden = true;
            return;
          }

          const cursor = view.coordsAtPos(selection.to);
          const offset = bubble.offsetParent?.getBoundingClientRect() || { left: 0, top: 0 };
          bubble.style.left = `${cursor.right - offset.left}px`;
          bubble.style.top = `${cursor.bottom - offset.top}px`;
          bubble.hidden = false;
        },
        destroy() {
          bubble.remove();
        },
      };
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
            .map((markType) => markType?.isInSet(node.marks))
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

// Finds all footnotes in selection
function selectedFootnoteAnchorRanges(state, footnoteMark) {
  const { from, to } = state.selection;
  if (from === to) return [];

  const ranges = [];
  state.doc.nodesBetween(from, to, (node, position) => {
    const footnote = node.isText ? footnoteMark.isInSet(node.marks) : null;
    const nodeEnd = position + node.nodeSize;
    if (footnote?.attrs.anchor) {
      ranges.push({ from: position, to: nodeEnd });
    }
    return true;
  });
  return ranges;
}

// Used for highlighting
const footnoteSelectionPluginKey = new PluginKey("footnoteSelection");
function footnoteSelectionPlugin(schema) {
  const footnoteMark = schema.marks.footnote;
  if (!footnoteMark) return null;

  const decorationsForSelection = (state) => {
    const { from, to } = state.selection;
    if (from === to) return DecorationSet.empty;

    const decorations = selectedFootnoteAnchorRanges(state, footnoteMark)
      .map(({ from: anchorFrom, to: anchorTo }) => Decoration.inline(anchorFrom, anchorTo, {
        class: "pm-footnote--selected",
      }));
    return DecorationSet.create(state.doc, decorations);
  };

  return new Plugin({
    key: footnoteSelectionPluginKey,
    state: {
      init: (_config, state) => decorationsForSelection(state),
      apply(transaction, decorations, _oldState, newState) {
        if (!transaction.docChanged && !transaction.selectionSet) return decorations;
        return decorationsForSelection(newState);
      },
    },
    props: {
      decorations: (state) => footnoteSelectionPluginKey.getState(state),
    },
  });
}

function footnotePastePlugin(schema) {
  const footnoteMark = schema.marks.footnote;
  if (!footnoteMark) return null;

  return new Plugin({
    props: {
      transformPasted(slice, view) {
        if (view.dragging?.move) return slice;
        return uniquePastedFootnoteIds(slice, usedFootnoteIds(view), footnoteMark);
      },
    },
  });
}

function usedFootnoteIds(view) {
  const views = new Set([
    view,
    ...pageEditorState.currentPageTextViews(),
    pageEditorState.blockEditorView,
  ]);

  const usedIds = new Set();
  for (const editorView of views) {
    if (!editorView?.state) continue;

    const footnoteMark = editorView.state.schema.marks.footnote;
    if (!footnoteMark) continue;

    editorView.state.doc.descendants((node) => {
      const footnote = node.isText ? footnoteMark.isInSet(node.marks) : null;
      if (footnote?.attrs.anchor && footnote.attrs.footnoteId) usedIds.add(footnote.attrs.footnoteId);
      return true;
    });
  }
  return usedIds;
}

// Replaces duplicated footnote IDs in pasted content with new UUIDs
function uniquePastedFootnoteIds(slice, usedIds, footnoteMark) {
  const uniqueId = () => {
    let footnoteId;
    do footnoteId = uuidv4(); while (usedIds.has(footnoteId));
    return footnoteId;
  };

  const pastedIds = new Map();

  const pastedFootnoteId = (footnoteId) => {
    if (pastedIds.has(footnoteId)) return pastedIds.get(footnoteId);

    const nextId = usedIds.has(footnoteId) ? uniqueId() : footnoteId;
    usedIds.add(nextId);
    pastedIds.set(footnoteId, nextId);
    return nextId;
  };

  const mapFragment = (fragment) => {
    let mapped = fragment;
    fragment.forEach((node, _offset, index) => {
      let nextNode = node;
      if (node.content.size) {
        const content = mapFragment(node.content);
        if (content !== node.content) nextNode = node.copy(content);
      }

      const footnote = footnoteMark.isInSet(nextNode.marks);
      const footnoteId = footnote?.attrs.footnoteId;
      if (footnote?.attrs.anchor && footnoteId) {
        const nextId = pastedFootnoteId(footnoteId);
        if (nextId !== footnoteId) {
          nextNode = nextNode.mark(nextNode.marks.map((mark) => (
            mark === footnote ? footnoteMark.create({ ...footnote.attrs, footnoteId: nextId }) : mark
          )));
        }
      }

      if (nextNode !== node) mapped = mapped.replaceChild(index, nextNode);
    });
    return mapped;
  };

  const content = mapFragment(slice.content);
  return content === slice.content ? slice : new Slice(content, slice.openStart, slice.openEnd);
}

function frozenFootnotePlugin(schema) {
  const footnoteMark = schema.marks.footnote;
  if (!footnoteMark) return null;

  const deletedRangeContainsFootnoteAnchor = (doc, from, to) => {
    let containsAnchor = false;
    doc.descendants((node, position) => {
      const footnote = node.isText ? footnoteMark.isInSet(node.marks) : null;
      if (footnote?.attrs.anchor && position >= from && position + node.nodeSize <= to) containsAnchor = true;
      return !containsAnchor;
    });
    return containsAnchor;
  };

  const deleteSelectionExceptFootnoteAnchors = (view) => {
    const { state } = view;
    const { from, to } = state.selection;
    const anchors = selectedFootnoteAnchorRanges(state, footnoteMark);
    if (!anchors.length) return false;

    let transaction = state.tr;
    let rangeEnd = to;
    for (const anchor of anchors.reverse()) {
      if (anchor.to < rangeEnd) transaction = transaction.delete(anchor.to, rangeEnd);
      rangeEnd = anchor.from;
    }
    if (from < rangeEnd) transaction = transaction.delete(from, rangeEnd);

    const cursor = Math.min(from, transaction.doc.content.size);
    view.dispatch(transaction.setSelection(TextSelection.create(transaction.doc, cursor)).scrollIntoView());
    return true;
  };

  return new Plugin({
    filterTransaction(transaction, state) {
      if (!pageEditorState.footnotesFrozen || !transaction.docChanged) return true;
      
      // For collaborative refreshes
      if (transaction.getMeta(ySyncPluginKey) || transaction.getMeta("syncedStream")) return true;

      let doc = state.doc;
      for (const step of transaction.steps) {
        let deletesFootnoteAnchor = false;
        step.getMap().forEach((from, to) => {
          if (to > from && deletedRangeContainsFootnoteAnchor(doc, from, to)) deletesFootnoteAnchor = true;
        });
        if (deletesFootnoteAnchor) return false;

        const result = step.apply(doc);
        if (result.failed) return true;
        doc = result.doc;
      }
      return true;
    },
    props: {
      handleKeyDown(view, event) {
        if (suggestionModeIsActive() || !pageEditorState.footnotesFrozen || !["Backspace", "Delete"].includes(event.key)) return false;
        if (!deleteSelectionExceptFootnoteAnchors(view)) return false;
        event.preventDefault();
        return true;
      },
    },
  });
}

function buildEditorKeymap(schema, { undoCommand, redoCommand, allowAnnotations = true }) {
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
  if (allowAnnotations && (type = schema.marks.comment)) {
    bind("Mod-Alt-m", startCommentCommand(type));
  }
  if (allowAnnotations && (type = schema.marks.footnote)) {
    bind("Mod-Alt-f", startFootnoteCommand(type));
  }
  if (allowAnnotations) {
    bind("Mod-Alt-s", (state, dispatch) => {
      if (!dispatch) return true;
      toggleSuggestionMode();
      dispatch(state.tr.setMeta("suggestionModeChanged", suggestionModeIsActive()));
      return true;
    });
  }

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
