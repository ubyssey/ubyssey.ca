// Prosemirror Toolbar
// https://prosemirror.net/examples/menu/

import { createRoot } from "react-dom/client";
import { setBlockType, toggleMark } from "prosemirror-commands";
import { undo, redo } from "prosemirror-history";
import { redoCommand as yRedo, undoCommand as yUndo, yUndoPluginKey } from "y-prosemirror";
import { wrapInList } from "prosemirror-schema-list";

import { markRangeAtCursor, startCommentCommand, startFootnoteCommand } from "../annotations/index.js";
import { promptLinkCommand } from "./link_dialog.jsx";
import { suggestionModeIsActive, toggleSuggestionMode } from "./index.jsx";
import { manuscriptSession } from "../session.js";

const TOOLBAR_ITEMS = [
  ["undo", "↶", "Undo"],
  ["redo", "↷", "Redo"],
  ["bold", "B", "Bold"],
  ["italic", "I", "Italic"],
  ["underline", "U", "Underline"],
  ["heading3", "h3", "Heading 3"],
  ["link", "Link", "Insert link"],
  // Can't figure out why these two don't work with history
  //["bulletList", "•", "Bullet list"],
  //["orderedList", "1.", "Ordered list"],
  ["comment", "💬", "Comment"],
  ["suggestionMode", "Suggest", "Toggle suggestion mode"],
  ["footnote", "Footnote", "Footnote"],
];

export function createEditorToolbar(root, {
  view = null,
  publishSource = null,
  getContentDoc = () => null,
  onHistoryCommand = () => {},
} = {}) {
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
        contentDoc={getContentDoc()}
        onHistoryCommand={onHistoryCommand}
        refresh={update}
      />,
    );
  }

  function runHistory(key) {
    const command = historyView && toolbarCommand(historyView, key);
    if (!command || !command(historyView.state, historyView.dispatch, historyView)) return false;

    if (historyView === activeView) activeView.dom.focus({ preventScroll: true });
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

function EditorToolbar({ view, historyView, publishSource, contentDoc, onHistoryCommand, refresh }) {
  const highlightedWords = view && !view.state.selection.empty
    ? countWords(view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, " ")) : null;

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
        <BlockControls actions={manuscriptSession.articleBlockActions} />
      </div>
      {publishSource && (
        <PublishToolbar
          source={publishSource}
          highlightedWords={highlightedWords}
          wordCount={contentWordCount(contentDoc)}
        />
      )}
    </div>
  );
}

function BlockControls({ actions }) {
  const state = actions?.getState() || {
    selected: false,
    upDisabled: true,
    downDisabled: true,
    editDisabled: true,
  };
  const buttons = [
    ["delete", "X", "Delete block", !state.selected],
    ["moveUp", "↑", "Move block up", state.upDisabled],
    ["moveDown", "↓", "Move block down", state.downDisabled],
    ["edit", "Edit", "Edit block", !state.selected || state.editDisabled],
    ["insert", "+", "Add block", !state.selected],
  ];

  return (
    <>
      <span className="pm-editor-toolbar__separator" aria-hidden="true" />
      {buttons.map(([action, label, title, disabled]) => (
        <button
          key={action}
          type="button"
          className={"pm-editor-toolbar__button pm-editor-toolbar__button--block-" + action}
          title={title}
          aria-label={title}
          disabled={disabled}
          onMouseDown={(event) => { event.preventDefault(); }}
          onClick={() => { actions?.[action](); }}
        >
          {label}
        </button>
      ))}
    </>
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

function countWords(text) {
  const words = String(text || "").trim();
  return words ? words.split(/\s+/).length : 0;
}

function contentWordCount(doc) {
  let text = "";
  const readText = (node) => {
    if (node.type === "text") text += ` ${node.text}`;
    (node.content || []).forEach(readText);
  };

  (doc?.content || [])
    .filter((block) => block.attrs?.blockType === "richtext")
    .forEach(readText);
  return countWords(text);
}

function PublishToolbar({ source, wordCount, highlightedWords }) {
  const status = source.querySelector("[data-article-status]");
  const published = source.querySelector("[data-article-published]");
  const saved = source.querySelector("[data-article-saved]");
  const liveLink = source.querySelector("[data-article-live-link]");
  const draftButton = source.querySelector('[data-article-action="draft"]');
  const publishButton = source.querySelector('[data-article-action="publish"]');

  return (
    <div className="pm-editor-toolbar__publish">
      {highlightedWords !== null && (
        <span className="pm-editor-toolbar__meta">
          Highlighted: {highlightedWords}
        </span>
      )}
      <span className="pm-editor-toolbar__meta">Word count: {wordCount}</span>
      {status && <span className="pm-editor-toolbar__meta">{status.textContent.trim()}</span>}
      {published && <span className="pm-editor-toolbar__meta">{published.textContent.trim()}</span>}
      {saved && <span className="pm-editor-toolbar__meta">{saved.textContent.trim()}</span>}
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

function toolbarCommand(view, key) {
  const { schema } = view.state;
  // Use yjs history for hidden streamfields which have yjs undo installed, preview editors still use prosemirror history
  const collaborative = Boolean(yUndoPluginKey.getState(view.state));
  const commands = {
    suggestionMode: (_state, dispatch) => {
      if (dispatch) toggleSuggestionMode();
      return true;
    },
    undo: collaborative ? yUndo : undo,
    redo: collaborative ? yRedo : redo,
    bold: schema.marks.strong && toggleMark(schema.marks.strong),
    italic: schema.marks.em && toggleMark(schema.marks.em),
    underline: schema.marks.underline && toggleMark(schema.marks.underline),
    // setBlockType is a Prosemirror function and is unrelated to wagtail blocks
    heading3: schema.nodes.heading && schema.nodes.paragraph && (toolbarItemIsActive(view, "heading3")
      ? setBlockType(schema.nodes.paragraph)
      : setBlockType(schema.nodes.heading, { level: 3 })),
    link: schema.marks.link && promptLinkCommand(schema.marks.link),
    // Disabled for now as I can't get them to work with history properly
    //bulletList: schema.nodes.bullet_list && wrapInList(schema.nodes.bullet_list),
    //orderedList: schema.nodes.ordered_list && wrapInList(schema.nodes.ordered_list),
    comment: schema.marks.comment && startCommentCommand(schema.marks.comment),
    footnote: schema.marks.footnote && startFootnoteCommand(schema.marks.footnote),
  };
  return commands[key] || null;
}
