// Pure prosemirror stuff, like toolbar

import "prosemirror-view/style/prosemirror.css";
import "prosemirror-gapcursor/style/gapcursor.css";

// Lots of plugins
import { createRoot } from "react-dom/client";
import { Schema } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes, liftListItem, sinkListItem, splitListItem, wrapInList } from "prosemirror-schema-list";
import { baseKeymap, chainCommands, exitCode, joinDown, joinUp, lift, selectParentNode, setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { undo, redo, history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { ellipsis, emDash, inputRules, smartQuotes, textblockTypeInputRule, undoInputRule, wrappingInputRule } from "prosemirror-inputrules";
import { commentMarkSpec, footnoteMarkSpec, markRangeAtCursor, startCommentCommand, startFootnoteCommand } from "./manuscript_annotations.jsx";

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
    buildEditorInputRules(schema),
    keymap(buildEditorKeymap(schema)),
    keymap(baseKeymap),
    dropCursor(),
    gapCursor(),
    history(),
  ];
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
  ["link", "Link", "Insert link"],
  ["bulletList", "•", "Bullet list"],
  ["orderedList", "1.", "Ordered list"],
  ["comment", "💬", "Comment"],
  ["footnote", "*", "Footnote"],
];

export function createEditorToolbar(root, { view = null, publishSource = null } = {}) {
  if (!root) return null;

  let activeView = view;
  const reactRoot = createRoot(root);

  function update() {
    reactRoot.render(
      <EditorToolbar
        view={activeView}
        publishSource={publishSource}
        refresh={update}
      />,
    );
  }

  update();
  return {
    setView(nextView) {
      activeView = nextView;
      update();
    },
    update,
  };
}

function EditorToolbar({ view, publishSource, refresh }) {
  return (
    <div className={`pm-editor-toolbar${publishSource ? " pm-editor-toolbar--article" : ""}`}>
      <div className="pm-editor-toolbar__tools">
        {TOOLBAR_ITEMS.map(([key, label, title]) => {
          const command = view && toolbarCommand(view, key);
          const enabled = Boolean(command && command(view.state));
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
                if (command(view.state, view.dispatch, view)) {
                  view.focus();
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
  const markNames = { bold: "strong", italic: "em", underline: "underline", link: "link", comment: "comment", footnote: "footnote" };
  const listNames = { bulletList: "bullet_list", orderedList: "ordered_list" };
  const mark = state.schema.marks[markNames[key]];
  const nodeType = state.schema.nodes[listNames[key]];

  if (mark) {
    const { from, $from, to, empty } = state.selection;
    if (empty) {
      return Boolean(key === "footnote" ? markRangeAtCursor(state, mark) : mark.isInSet(state.storedMarks || $from.marks()));
    }
    return state.doc.rangeHasMark(from, to, mark);
  }

  if (!nodeType) return false;

  const { from, $from, to } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type === nodeType) return true;
  }

  let active = false;
  if (to > from) {
    state.doc.nodesBetween(from, to, (node) => {
      if (node.type !== nodeType) return true;
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
  return (state, dispatch) => {
    if (!dispatch) return true;

    const attrs = linkMarkAttrsAtSelection(state, linkMark);
    const rawHref = window.prompt("Enter link URL. Leave blank to remove link.", attrs?.href || "");
    if (rawHref === null) return false;

    let href = String(rawHref || "").trim();
    if (/^(javascript|data):/i.test(href)) {
      window.alert("Links cannot use javascript: or data: URLs.");
      return false;
    }
    if (href && !/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^[#/?]/.test(href)) href = `https://${href}`;

    const { from, to, empty } = state.selection;
    if (!href) {
      const range = empty ? markRangeAtCursor(state, linkMark, attrs) : null;
      let tr = state.tr;
      if (range) tr = tr.removeMark(range.from, range.to, linkMark);
      else if (empty) tr = tr.removeStoredMark(linkMark);
      else tr = tr.removeMark(from, to, linkMark);
      dispatch(tr.scrollIntoView());
      return true;
    }

    const mark = linkMark.create({ href });
    if (empty) {
      const range = attrs ? markRangeAtCursor(state, linkMark, attrs) : null;
      if (range) {
        dispatch(state.tr.removeMark(range.from, range.to, linkMark).addMark(range.from, range.to, mark).scrollIntoView());
        return true;
      }

      const text = window.prompt("Link text", href);
      if (text === null || !text.trim()) return false;
      dispatch(state.tr.replaceSelectionWith(state.schema.text(text, [mark]), false).scrollIntoView());
      return true;
    }

    dispatch(state.tr.removeMark(from, to, linkMark).addMark(from, to, mark).scrollIntoView());
    return true;
  };
}

function linkMarkAttrsAtSelection(state, linkMark) {
  const { from, to, empty, $from } = state.selection;

  if (empty) {
    const range = markRangeAtCursor(state, linkMark);
    if (range) return range.attrs;
    return linkMark.isInSet(state.storedMarks || $from.marks())?.attrs || null;
  }

  let attrs = null;
  state.doc.nodesBetween(from, to, (node) => {
    const mark = linkMark.isInSet(node.marks);
    if (!mark) return true;
    attrs = mark.attrs;
    return false;
  });
  return attrs;
}

function toolbarCommand(view, key) {
  const { schema } = view.state;
  const commands = {
    undo,
    redo,
    bold: schema.marks.strong && toggleMark(schema.marks.strong),
    italic: schema.marks.em && toggleMark(schema.marks.em),
    underline: schema.marks.underline && toggleMark(schema.marks.underline),
    link: schema.marks.link && promptLinkCommand(schema.marks.link),
    bulletList: schema.nodes.bullet_list && wrapInList(schema.nodes.bullet_list),
    orderedList: schema.nodes.ordered_list && wrapInList(schema.nodes.ordered_list),
    comment: schema.marks.comment && startCommentCommand(schema.marks.comment),
    footnote: schema.marks.footnote && startFootnoteCommand(schema.marks.footnote),
  };
  return commands[key] || null;
}
