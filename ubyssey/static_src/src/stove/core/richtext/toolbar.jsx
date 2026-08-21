// Prosemirror Toolbar
// https://prosemirror.net/examples/menu/

import { createRoot } from "react-dom/client";
import { setBlockType, toggleMark } from "prosemirror-commands";
import { undo, redo } from "prosemirror-history";
import { markRangeAtCursor, startFootnoteCommand, startCommentCommand } from "./annotations/index.js";
import { promptLinkCommand } from "./link_dialog.jsx";
import { suggestionModeIsActive, toggleSuggestionMode } from "./plugins.js";

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
  history = null,
  onHistoryCommand = () => {},
  renderExtraControls = () => null,
} = {}) {
  if (!root) return null;

  let activeView = view;
  const reactRoot = createRoot(root);

  function update() {
    reactRoot.render(
      <EditorToolbar
        view={activeView}
        publishSource={publishSource}
        contentDoc={getContentDoc()}
        history={history}
        onHistoryCommand={onHistoryCommand}
        extraControls={renderExtraControls()}
        refresh={update}
      />,
    );
  }

  function runHistory(key) {
    if (history && ["undo", "redo"].includes(key)) {
      if (!history[key]()) return false;
      activeView?.dom.focus({ preventScroll: true });
      onHistoryCommand();
      update();
      return true;
    }
    const command = activeView && toolbarCommand(activeView, key);
    if (!command || !command(activeView.state, activeView.dispatch, activeView)) return false;

    activeView.dom.focus({ preventScroll: true });
    onHistoryCommand();
    update();
    return true;
  }

  update();
  return {
    setView(nextView) {
      activeView = nextView;
      update();
    },
    runHistory,
    update,
    destroy() {
      reactRoot.unmount();
    },
  };
}

function EditorToolbar({ view, publishSource, contentDoc, history, onHistoryCommand, refresh, extraControls }) {
  const highlightedWords = view && !view.state.selection.empty
    ? countWords(view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, " ")) : null;

  return (
    <div className={`pm-editor-toolbar${publishSource ? " pm-editor-toolbar--page" : ""}`}>
      <div className="pm-editor-toolbar__tools">
        {TOOLBAR_ITEMS.map(([key, label, title]) => {
          const historyAction = history && ["undo", "redo"].includes(key);
          const command = view && toolbarCommand(view, key);
          const enabled = historyAction ? history[key === "undo" ? "canUndo" : "canRedo"]() : Boolean(command && command(view.state));
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
                const handled = historyAction ? history[key]() : command?.(view.state, view.dispatch, view);
                if (handled) {
                  view.focus();
                  if (["undo", "redo"].includes(key)) onHistoryCommand();
                  refresh();
                }
              }}
            >
              {label}
            </button>
          );
        })}
        {extraControls}
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

function toolbarItemIsActive(view, key) {
  if (key === "suggestionMode") return suggestionModeIsActive();

  const { state } = view;
  const markNames = { bold: "strong", italic: "em", underline: "underline", link: "link", footnote: "footnote" };
  const headingLevel = key === "heading3" ? 3 : null;
  const mark = state.schema.marks[markNames[key]];
  const nodeType = headingLevel ? state.schema.nodes.heading : null;

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
  doc?.forEach((block) => {
    if (block.attrs?.blockType === "richtext") text += ` ${block.textContent}`;
  });
  return countWords(text);
}

function PublishToolbar({ source, wordCount, highlightedWords }) {
  const status = source.querySelector("[data-page-status]");
  const published = source.querySelector("[data-page-published]");
  const saved = source.querySelector("[data-page-saved]");
  const liveLink = source.querySelector("[data-page-live-link]");
  const draftButton = source.querySelector('[data-editor-action="draft"]');
  const publishButton = source.querySelector('[data-editor-action="publish"]');

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
  // We don't use YJS history cause each RichText block has it's own EditorView, Prosemirror History is used for Page Fields for Direct Django Forms
  const sharedHistory = view.streamSource?.instance.history;
  const commands = {
    suggestionMode: (_state, dispatch) => {
      if (dispatch) toggleSuggestionMode();
      return true;
    },
    undo: sharedHistory ? sharedHistoryCommand(sharedHistory, "undo") : undo,
    redo: sharedHistory ? sharedHistoryCommand(sharedHistory, "redo") : redo,
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

// Adapts stream history to Prosemirror commands
function sharedHistoryCommand(history, action) {
  return (_state, dispatch) => {
    if (!dispatch) return action === "undo" ? history.canUndo() : history.canRedo();
    return history[action]();
  };
}
