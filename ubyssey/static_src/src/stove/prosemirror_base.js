// Pure prosemirror stuff, like toolbar

import "prosemirror-view/style/prosemirror.css";
import "prosemirror-gapcursor/style/gapcursor.css";

// Lots of plugins
import { Schema } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes, liftListItem, sinkListItem, splitListItem, wrapInList } from "prosemirror-schema-list";
import { baseKeymap, chainCommands, exitCode, joinDown, joinUp, lift, selectParentNode, setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { undo, redo, history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { ellipsis, emDash, inputRules, smartQuotes, textblockTypeInputRule, undoInputRule, wrappingInputRule } from "prosemirror-inputrules";

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

export function makeButton(text, onClick, title = text, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.title = title;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    onClick();
  });
  return button;
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
];

export function createEditorToolbar(root, { view = null, publishSource = null } = {}) {
  if (!root) return null;

  let activeView = view;
  const toolbar = document.createElement("div");
  toolbar.className = `pm-editor-toolbar${publishSource ? " pm-editor-toolbar--article" : ""}`;

  const tools = document.createElement("div");
  tools.className = "pm-editor-toolbar__tools";
  toolbar.appendChild(tools);

  const buttons = TOOLBAR_ITEMS.map(([key, label, title]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pm-editor-toolbar__button pm-editor-toolbar__button--${key}`;
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("mousedown", (event) => { event.preventDefault(); });
    button.addEventListener("click", () => {
      const command = activeView && toolbarCommand(activeView, key);
      if (command?.(activeView.state, activeView.dispatch, activeView)) {
        activeView.focus();
        update();
      }
    });
    tools.appendChild(button);
    return { key, button };
  });

  if (publishSource) toolbar.appendChild(createPublishToolbar(publishSource));
  root.replaceChildren(toolbar);

  function update() {
    for (const { key, button } of buttons) {
      const command = activeView && toolbarCommand(activeView, key);
      const enabled = Boolean(command && command(activeView.state));
      button.disabled = !enabled;

      let active = false;
      if (activeView) {
        const { state } = activeView;
        const markNames = { bold: "strong", italic: "em", underline: "underline", link: "link" };
        const listNames = { bulletList: "bullet_list", orderedList: "ordered_list" };
        const mark = state.schema.marks[markNames[key]];
        const nodeType = state.schema.nodes[listNames[key]];

        if (mark) {
          const { from, $from, to, empty } = state.selection;
          active = empty ? Boolean(mark.isInSet(state.storedMarks || $from.marks())) : state.doc.rangeHasMark(from, to, mark);
        } else if (nodeType) {
          const { from, $from, to } = state.selection;
          for (let depth = $from.depth; depth > 0; depth -= 1) {
            if ($from.node(depth).type === nodeType) active = true;
          }

          if (!active && to > from) {
            state.doc.nodesBetween(from, to, (node) => {
              if (node.type !== nodeType) return true;
              active = true;
              return false;
            });
          }
        }
      }

      button.setAttribute("aria-pressed", String(active));
    }
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

function createPublishToolbar(source) {
  const publish = document.createElement("div");
  publish.className = "pm-editor-toolbar__publish";

  for (const selector of ["[data-article-status]", "[data-article-published]"]) {
    const sourceItem = source.querySelector(selector);
    if (!sourceItem) continue;
    const item = document.createElement("span");
    item.className = "pm-editor-toolbar__meta";
    item.textContent = sourceItem.textContent.trim();
    publish.appendChild(item);
  }

  const liveLink = source.querySelector("[data-article-live-link]");
  if (liveLink?.href) {
    const link = document.createElement("a");
    link.className = "pm-editor-toolbar__link";
    link.href = liveLink.href;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = liveLink.textContent.trim() || "View Live";
    publish.appendChild(link);
  }

  for (const action of ["draft", "publish"]) {
    const sourceButton = source.querySelector(`[data-article-action="${action}"]`);
    if (!sourceButton) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pm-editor-toolbar__action pm-editor-toolbar__action--${action}`;
    button.textContent = sourceButton.textContent.trim();
    button.addEventListener("click", () => {
      if (sourceButton.form?.requestSubmit) sourceButton.form.requestSubmit(sourceButton);
      else sourceButton.click();
    });
    publish.appendChild(button);
  }

  return publish;
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

function markRangeAtCursor(state, markType, attrs = null) {
  const { $from } = state.selection;
  const parent = $from.parent;
  const offset = $from.parentOffset;
  let pos = 0;
  let match = null;
  let matchIndex = -1;
  let matchStart = 0;

  for (let index = 0; index < parent.childCount; index += 1) {
    const child = parent.child(index);
    const start = pos;
    const end = start + child.nodeSize;
    const mark = markType.isInSet(child.marks);
    if (mark && (!attrs || sameMarkAttrs(mark.attrs, attrs)) && start <= offset && offset <= end) {
      match = mark;
      matchIndex = index;
      matchStart = start;
      break;
    }
    pos = end;
  }

  if (!match) return null;

  let fromOffset = matchStart;
  let toOffset = matchStart + parent.child(matchIndex).nodeSize;

  for (let index = matchIndex - 1; index >= 0; index -= 1) {
    const child = parent.child(index);
    const mark = markType.isInSet(child.marks);
    if (!mark || !sameMarkAttrs(mark.attrs, match.attrs)) break;
    fromOffset -= child.nodeSize;
  }

  for (let index = matchIndex + 1; index < parent.childCount; index += 1) {
    const child = parent.child(index);
    const mark = markType.isInSet(child.marks);
    if (!mark || !sameMarkAttrs(mark.attrs, match.attrs)) break;
    toOffset += child.nodeSize;
  }

  const parentStart = $from.start();
  return { from: parentStart + fromOffset, to: parentStart + toOffset, attrs: match.attrs };
}

function sameMarkAttrs(left, right) {
  return JSON.stringify(left || {}) === JSON.stringify(right || {});
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
  };
  return commands[key] || null;
}
