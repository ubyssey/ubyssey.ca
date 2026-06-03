import "prosemirror-view/style/prosemirror.css";
import "prosemirror-gapcursor/style/gapcursor.css";

import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema, DOMParser, DOMSerializer, Fragment } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes, liftListItem, sinkListItem, splitListItem, wrapInList } from "prosemirror-schema-list";
import {
  baseKeymap,
  chainCommands,
  exitCode,
  joinDown,
  joinUp,
  lift,
  selectParentNode,
  setBlockType,
  toggleMark,
  wrapIn,
} from "prosemirror-commands";
import { undo, redo, history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import {
  ellipsis,
  emDash,
  inputRules,
  smartQuotes,
  textblockTypeInputRule,
  undoInputRule,
  wrappingInputRule,
} from "prosemirror-inputrules";
// Apparently how Wagtail generates block IDs.
import { v4 as uuidv4 } from "uuid";

// Should be deleted before save
const RICH_TEXT_CHROME_SELECTORS = [
  ".pm-stream-block__header",
  ".pm-stream-block__label",
  ".pm-stream-block__title",
  ".pm-stream-block__id",
  ".pm-stream-block__meta",
  ".pm-article-block-controls",
  ".pm-article-block-controls-layer",
  ".pm-article-block-outline",
  ".pm-editor-toolbar",
  ".pm-editable-field__label",
];

// Should be deleted before save, but contents should remain
const RICH_TEXT_WRAPPER_SELECTORS = [
  ".pm-stream-block",
  ".pm-stream-block__content",
  ".pm-editable-field",
  ".pm-editable-field__content",
];

// Schema :(
const baseNodesWithLists = addListNodes(
  basicSchema.spec.nodes,
  "paragraph block*",
  "block",
);

const nodes = baseNodesWithLists.remove("doc").append({
  doc: {
    content: "stream_block+",
  },

  stream_block: {
    content: "(editable_field | control_field | list_field)*",
    isolating: true,
    defining: true,
    attrs: {
      id: { default: null },
      blockType: { default: null },
      originalValue: { default: null },
    },
    toDOM(node) {
      return [
        "section",
        {
          class: "pm-stream-block",
          "data-block-type": node.attrs.blockType || "",
        },
        [
          "div",
          { class: "pm-stream-block__label" },
          node.attrs.blockType || "block",
        ],
        ["div", { class: "pm-stream-block__body" }, 0],
      ];
    },
  },

  editable_field: {
    content: "block*",
    isolating: true,
    defining: true,
    attrs: {
      path: { default: [] },
      label: { default: "Content" },
      mode: { default: "richtext" },
      manuscriptOwned: { default: false },
    },
    toDOM(node) {
      return [
        "div",
        {
          class: "pm-editable-field",
          "data-field-label": node.attrs.label || "Content",
        },
        [
          "div",
          { class: "pm-editable-field__label" },
          node.attrs.label || "Content",
        ],
        ["div", { class: "pm-editable-field__body" }, 0],
      ];
    },
  },

  control_field: {
    atom: true,
    selectable: false,
    isolating: true,
    attrs: {
      path: { default: [] },
      label: { default: "Field" },
      controlType: { default: "text" },
      value: { default: null },
      options: { default: null },
    },
    toDOM(node) {
      return [
        "div",
        {
          class: "pm-control-field",
          "data-field-label": node.attrs.label || "Field",
          "data-control-type": node.attrs.controlType || "text",
        },
      ];
    },
  },

  list_field: {
    content: "list_item*",
    isolating: true,
    defining: true,
    attrs: {
      path: { default: [] },
      label: { default: "List" },
      itemValue: { default: null },
      itemFields: { default: [] },
    },
    toDOM(node) {
      return [
        "div",
        { class: "pm-list-field", "data-field-label": node.attrs.label || "List" },
        ["div", { class: "pm-list-field__label" }, node.attrs.label || "List"],
        ["div", { class: "pm-list-field__items" }, 0],
      ];
    },
  },

  list_item: {
    content: "(editable_field | control_field | list_field)*",
    isolating: true,
    defining: true,
    attrs: {
      originalValue: { default: null },
    },
    toDOM() {
      return ["div", { class: "pm-list-item" }, ["div", { class: "pm-list-item__content" }, 0]];
    },
  },
});

const marks = basicSchema.spec.marks.append({
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

const richTextSchema = new Schema({
  nodes: baseNodesWithLists,
  marks,
});

const streamSchema = new Schema({
  nodes,
  marks,
});

const isMac = typeof navigator !== "undefined" && /Mac|iP(hone|[oa]d)/.test(navigator.platform);

function editorPlugins(schema) {
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

// Nodeviews -> https://prosemirror.net/docs/ref/#view.NodeView
function makeButton(text, onClick, title = text, className = "") {
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

function refreshMoveControls(view) {
  const groups = [
    {
      items: Array.from(view.dom.children).filter((element) => element.classList?.contains("pm-stream-block")),
      upSelector: ":scope > .pm-stream-block__header button[title='Up']",
      downSelector: ":scope > .pm-stream-block__header button[title='Down']",
    },
    ...Array.from(view.dom.querySelectorAll(".pm-list-field__items")).map((listItems) => ({
      items: Array.from(listItems.children).filter((element) => element.classList?.contains("pm-list-item")),
      upSelector: ":scope > .pm-list-item__header button[title='Up']",
      downSelector: ":scope > .pm-list-item__header button[title='Down']",
    })),
  ];

  for (const { items, upSelector, downSelector } of groups) {
    items.forEach((item, index) => {
      const upButton = item.querySelector(upSelector);
      const downButton = item.querySelector(downSelector);
      if (upButton) upButton.disabled = index === 0;
      if (downButton) downButton.disabled = index === items.length - 1;
    });
  }
}

class StreamBlockView {
  constructor(node, view, getPos, options = {}) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.blockRegistry = options.blockRegistry;
    this.streamFieldName = options.streamFieldName;
    this.availableBlockTypes = options.availableBlockTypes || [];

    this.dom = document.createElement("section");
    this.dom.className = "pm-stream-block";
    this.dom.dataset.blockType = node.attrs.blockType || "";
    this.dom.dataset.streamBlockId = node.attrs.id || "";
    this.dom.dataset.streamBlockIndex = "";

    this.header = document.createElement("div");
    this.header.className = "pm-stream-block__header";

    const titleWrap = document.createElement("div");
    titleWrap.className = "pm-stream-block__heading";

    this.title = document.createElement("div");
    this.title.className = "pm-stream-block__title";
    this.title.textContent = node.attrs.blockType || "block";

    this.id = document.createElement("div");
    this.id.className = "pm-stream-block__id";

    titleWrap.appendChild(this.title);
    titleWrap.appendChild(this.id);

    this.controls = this.createControls();

    this.header.appendChild(titleWrap);
    this.header.appendChild(this.controls);

    this.contentDOM = document.createElement("div");
    this.contentDOM.className = "pm-stream-block__content";

    this.dom.appendChild(this.header);
    this.dom.appendChild(this.contentDOM);

    this.refreshUI(node);
  }

  createControls() {
    const controls = document.createElement("div");
    controls.className = "pm-stream-block__controls";

    this.insertSelect = document.createElement("select");
    this.insertSelect.className = "pm-stream-block__insert-select";
    this.insertSelect.setAttribute("aria-label", "Block type to insert");

    for (const blockType of this.availableBlockTypes) {
      const option = document.createElement("option");
      option.value = blockType;
      option.textContent = blockType;
      this.insertSelect.appendChild(option);
    }

    this.insertButton = makeButton("+", () => {
      this.insertBlock(this.insertSelect.value);
    }, "Insert", "pm-stream-block__button");

    this.moveUpButton = makeButton("↑", () => { this.moveBlock(-1); }, "Up", "pm-stream-block__button");
    this.moveDownButton = makeButton("↓", () => { this.moveBlock(1); }, "Down", "pm-stream-block__button");
    this.deleteButton = makeButton("Del", () => { this.deleteBlock(); }, "Delete", "pm-stream-block__button");
    this.deleteButton.classList.add("pm-stream-block__button--danger");

    controls.appendChild(this.insertSelect);
    controls.appendChild(this.insertButton);
    controls.appendChild(this.moveUpButton);
    controls.appendChild(this.moveDownButton);
    controls.appendChild(this.deleteButton);

    return controls;
  }

  insertBlock(blockType) {
    const pos = this.getPos();

    const blockDefinition = this.blockRegistry?.byStreamField?.[this.streamFieldName]?.[blockType] || {};
    const defaultValue = blockDefinition.defaultValue !== undefined ? blockDefinition.defaultValue : "";
    const pmNode = streamSchema.nodeFromJSON(streamBlockToPmNode({
      type: blockType,
      id: uuidv4(),
      value: clone(defaultValue),
      fields: clone(blockDefinition.defaultFields || []),
    }));

    const insertPos = pos + this.node.nodeSize;
    const tr = this.view.state.tr.insert(insertPos, pmNode);
    this.view.dispatch(tr);
    this.view.focus();
  }

  deleteBlock() {
    const pos = this.getPos();
    const { doc, tr } = this.view.state;

    // Currently need at least one child (+ not *)
    if (doc.childCount <= 1) {
      const replacement = streamSchema.nodeFromJSON(createEmptyRichTextBlock());
      this.view.dispatch(tr.replaceWith(pos, pos + this.node.nodeSize, replacement));
      this.view.focus();
      return;
    }

    this.view.dispatch(tr.delete(pos, pos + this.node.nodeSize));
    this.view.focus();
  }

  getTopLevelBlockInfoAtPos(doc, pos) {
    let offset = 0;
    for (let index = 0; index < doc.childCount; index += 1) {
      const node = doc.child(index);
      const start = offset;
      const end = start + node.nodeSize;

      if (pos === start) {
        return { index, node, start, end };
      }
      offset = end;
    }
    return null;
  }

  moveBlock(direction) {
    const blockInfo = this.getTopLevelBlockInfoAtPos(this.view.state.doc, this.getPos());

    if (!blockInfo) {
      return;
    }

    const targetIndex = blockInfo.index + direction;

    if (targetIndex < 0 || targetIndex >= this.view.state.doc.childCount) {
      return;
    }

    const blocks = [];
    for (let index = 0; index < this.view.state.doc.childCount; index += 1) {
      blocks.push(this.view.state.doc.child(index));
    }

    [blocks[blockInfo.index], blocks[targetIndex]] = [blocks[targetIndex], blocks[blockInfo.index]];
    this.view.dispatch(this.view.state.tr.replaceWith(
      0,
      this.view.state.doc.content.size,
      Fragment.fromArray(blocks),
    ));
    this.view.focus();
  }

  refreshUI(node) {
    const blockId = node.attrs.id || "";
    this.dom.dataset.blockType = node.attrs.blockType || "";
    this.dom.dataset.streamBlockId = blockId;
    this.title.textContent = node.attrs.blockType || "block";
    this.id.textContent = blockId;
    this.id.title = blockId ? `id ${blockId}` : "";

    const pos = this.getPos();
    const info = this.getTopLevelBlockInfoAtPos(this.view.state.doc, pos);

    if (info) {
      this.dom.dataset.streamBlockIndex = String(info.index);
      this.moveUpButton.disabled = info.index === 0;
      this.moveDownButton.disabled = info.index === this.view.state.doc.childCount - 1;
    }
  }

  update(node) {
    if (node.type !== this.node.type) {
      return false;
    }

    this.node = node;
    this.dom.dataset.blockType = node.attrs.blockType || "";
    this.refreshUI(node);
    return true;
  }

  stopEvent(event) {
    return ["BUTTON", "SELECT", "OPTION"].includes(event.target?.nodeName);
  }

  ignoreMutation(mutation) {
    return (
      (mutation.type === "attributes" && mutation.target === this.dom) ||
      mutation.target === this.header ||
      this.header.contains(mutation.target)
    );
  }
}

class EditableFieldView {
  constructor(node) {
    this.node = node;
    const isManuscriptOwned = Boolean(node.attrs.manuscriptOwned);

    this.dom = document.createElement("div");
    this.dom.className = `pm-editable-field${isManuscriptOwned ? " pm-editable-field--manuscript-owned" : ""}`;

    const label = document.createElement("div");
    label.className = "pm-editable-field__label";
    label.textContent = node.attrs.label || "Content";

    this.contentDOM = document.createElement("div");
    this.contentDOM.className = "pm-editable-field__content";

    this.dom.appendChild(label);
    this.dom.appendChild(this.contentDOM);
  }
}

class ListFieldView {
  constructor(node, view, getPos) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement("div");
    this.dom.className = "pm-list-field";

    this.header = document.createElement("div");
    this.header.className = "pm-list-field__header";

    this.label = document.createElement("div");
    this.label.className = "pm-list-field__label";
    this.label.textContent = node.attrs.label || "List";

    this.addButton = makeButton("+", () => { this.addItem(); }, "Add");

    this.header.appendChild(this.label);
    this.header.appendChild(this.addButton);

    this.contentDOM = document.createElement("div");
    this.contentDOM.className = "pm-list-field__items";

    this.dom.appendChild(this.header);
    this.dom.appendChild(this.contentDOM);
  }

  addItem() {
    const item = streamSchema.nodeFromJSON(listItemToPmNode(this.node.attrs));
    const pos = this.getPos() + this.node.nodeSize - 1;
    this.view.dispatch(this.view.state.tr.insert(pos, item));
    this.view.focus();
  }

  update(node) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.label.textContent = node.attrs.label || "List";
    return true;
  }

  stopEvent(event) {
    return ["BUTTON"].includes(event.target?.nodeName);
  }

  ignoreMutation(mutation) {
    return (mutation.target === this.header || this.header.contains(mutation.target));
  }
}

class ListItemView {
  constructor(node, view, getPos) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement("div");
    this.dom.className = "pm-list-item";

    this.header = document.createElement("div");
    this.header.className = "pm-list-item__header";

    this.title = document.createElement("div");
    this.title.className = "pm-list-item__title";

    this.upButton = makeButton("↑", () => { this.moveItem(-1); }, "Up");
    this.downButton = makeButton("↓", () => { this.moveItem(1); }, "Down");
    this.deleteButton = makeButton("Del", () => { this.deleteItem(); }, "Delete");

    this.header.appendChild(this.title);
    this.header.appendChild(this.upButton);
    this.header.appendChild(this.downButton);
    this.header.appendChild(this.deleteButton);

    this.contentDOM = document.createElement("div");
    this.contentDOM.className = "pm-list-item__content";

    this.dom.appendChild(this.header);
    this.dom.appendChild(this.contentDOM);
    this.refreshUI();
  }

  itemInfo() {
    const pos = this.getPos();
    const resolved = this.view.state.doc.resolve(pos);
    const parent = resolved.parent;
    const index = resolved.index();
    let start = resolved.start();
    const parentStart = start;
    const parentEnd = resolved.end();

    for (let itemIndex = 0; itemIndex < index; itemIndex += 1) {
      start += parent.child(itemIndex).nodeSize;
    }

    const node = parent.child(index);
    return { parent, index, node, start, end: start + node.nodeSize, parentStart, parentEnd };
  }

  deleteItem() {
    const info = this.itemInfo();
    this.view.dispatch(this.view.state.tr.delete(info.start, info.end));
    this.view.focus();
  }

  moveItem(direction) {
    const info = this.itemInfo();
    const targetIndex = info.index + direction;

    if (targetIndex < 0 || targetIndex >= info.parent.childCount) return;

    const items = [];
    for (let index = 0; index < info.parent.childCount; index += 1) {
      items.push(info.parent.child(index));
    }

    [items[info.index], items[targetIndex]] = [items[targetIndex], items[info.index]];
    this.view.dispatch(this.view.state.tr.replaceWith(
      info.parentStart,
      info.parentEnd,
      Fragment.fromArray(items),
    ));
    this.view.focus();
  }

  refreshUI() {
    const info = this.itemInfo();
    this.title.textContent = `#${info.index + 1}`;
    this.upButton.disabled = info.index === 0;
    this.downButton.disabled = info.index === info.parent.childCount - 1;
  }

  update(node) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.refreshUI();
    return true;
  }

  stopEvent(event) {
    return ["BUTTON"].includes(event.target?.nodeName);
  }

  ignoreMutation(mutation) {
    return (mutation.target === this.header || this.header.contains(mutation.target));
  }
}

class ControlFieldView {
  constructor(node, view, getPos) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.dom = document.createElement("div");
    this.dom.className = `pm-control-field pm-control-field--${node.attrs.controlType || "text"}`;

    this.label = document.createElement("label");
    this.label.className = "pm-control-field__label";
    this.label.textContent = node.attrs.label || "Field";

    this.inputWrap = document.createElement("div");
    this.inputWrap.className = "pm-control-field__input";

    this.input = this.createInput(node);
    this.inputWrap.appendChild(this.input);

    this.dom.appendChild(this.label);
    this.dom.appendChild(this.inputWrap);
  }

  createInput(node) {
    const controlType = node.attrs.controlType;
    const value = node.attrs.value ?? "";

    if (controlType === "boolean") {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(node.attrs.value);

      input.addEventListener("change", () => {
        this.updateValue(input.checked);
      });

      return input;
    }

    if (controlType === "choice") {
      const select = document.createElement("select");
      const options = node.attrs.options || [];

      for (const option of options) {
        const optionElement = document.createElement("option");
        optionElement.value = String(option.value);
        optionElement.textContent = option.label;
        optionElement.selected = String(option.value) === String(value);
        select.appendChild(optionElement);
      }

      select.addEventListener("change", () => {
        this.updateValue(select.value);
      });

      return select;
    }

    if (controlType === "number") {
      const input = document.createElement("input");
      input.type = "number";
      input.value = value;

      input.addEventListener("input", () => {
        const rawValue = input.value.trim();
        const nextValue = rawValue === "" ? null : Number(rawValue);
        this.updateValue(Number.isNaN(nextValue) ? null : nextValue);
      });

      return input;
    }

    if (controlType === "image" || controlType === "document") {
      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.placeholder = controlType === "image" ? "Image ID" : "Document ID";
      input.value = value;

      input.addEventListener("input", () => {
        const rawValue = input.value.trim();
        const nextValue = rawValue ? Number(rawValue) : null;
        this.updateValue(Number.isNaN(nextValue) ? null : nextValue);
      });

      return input;
    }

    const input = document.createElement("input");
    input.type = "text";
    input.value = value;

    input.addEventListener("input", () => {
      this.updateValue(input.value);
    });

    return input;
  }

  updateValue(value) {
    const pos = this.getPos();

    const nextAttrs = { ...this.node.attrs, value };

    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, nextAttrs);
    this.view.dispatch(tr);
  }

  update(node) {
    this.node = node;
    if (node.attrs.controlType === "boolean") {
      this.input.checked = Boolean(node.attrs.value);
    } else {
      this.input.value = node.attrs.value ?? "";
    }
    return true;
  }

  stopEvent(event) {
    return ["INPUT", "SELECT", "OPTION", "LABEL", "BUTTON"].includes(event.target?.nodeName);
  }

  ignoreMutation() {
    return true;
  }
}

// Initialization
const editorInstances = [];
const manuscriptRichTextEditors = [];
let articleBlockControlsState = null;
let articleEditorToolbar = null;
let selectedArticleBlock = null;
let suppressedArticleHoverBlock = null;
let suppressedArticleHoverTimer = null;
const articleInsertBlockTypes = new Map();
let scheduleManuscriptPreview = () => {};

function setupArticleShadow() {
  const host = document.querySelector("[data-article-shadow]");
  if (!host) {
    return null;
  }

  const articleStylesheets = Array.from(host.querySelectorAll("[data-article-stylesheet]"));
  const articleStylesheetHrefs = articleStylesheets
    .map((stylesheet) => stylesheet.getAttribute("href"))
    .filter(Boolean);

  for (const stylesheet of articleStylesheets) {
    stylesheet.remove();
  }

  const articleHtml = host.innerHTML;
  host.innerHTML = "";

  const shadowRoot = host.shadowRoot || host.attachShadow({ mode: "open" });
  shadowRoot.innerHTML = "";

  const stylesheets = [
    host.dataset.typekitCss,
    host.dataset.bootstrapCss,
    ...articleStylesheetHrefs,
    host.dataset.shadowEditorCss,
  ].filter(Boolean);

  for (const href of stylesheets) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    shadowRoot.appendChild(link);
  }

  for (const style of document.querySelectorAll("style")) {
    if (style.textContent?.includes("ProseMirror")) {
      shadowRoot.appendChild(style.cloneNode(true));
    }
  }

  const toolbar = document.createElement("div");
  toolbar.className = "pm-manuscript-toolbar";
  shadowRoot.appendChild(toolbar);

  const wrapper = document.createElement("main");
  wrapper.className = "article-shadow-preview article";
  wrapper.innerHTML = articleHtml;
  shadowRoot.appendChild(wrapper);

  return shadowRoot;
}

document.addEventListener("DOMContentLoaded", () => {
  const manuscriptRoot = setupArticleShadow();
  const blockRegistry = { byStreamField: readJsonScript("block-registry") };
  const editorData = readJsonScript("editor-data");
  const editorErrors = readJsonScript("editor-errors");

  if (JSON.stringify(editorErrors) !== "{}") {
    alert("Failed to save due to errors: " + JSON.stringify(editorErrors));
  }

  const textareas = Array.from(document.querySelectorAll("[data-stream-json]"));
  for (const textarea of textareas) {
    createStreamEditor(textarea, blockRegistry, editorData[textarea.dataset.streamField] || []);
  }

  articleEditorToolbar = createEditorToolbar(manuscriptRoot?.querySelector(".pm-manuscript-toolbar"), {
    publishSource: document.querySelector("[data-article-toolbar-source]"),
  });
  createManuscriptRichTextEditors(manuscriptRoot);
  createArticleBlockControls(manuscriptRoot);
  setupArticleBlockKeyboard(manuscriptRoot);
  setupMetadataResize();
  setupMetadataTabs();

  const form = document.querySelector("[data-manuscript-form]");
  setupServerPreview(form, manuscriptRoot);

  form.addEventListener("submit", () => {
    for (const instance of editorInstances) {
      instance.writeBackToTextarea();
    }
  });

  window.manuscriptEditors = editorInstances;
  window.manuscriptRichTextEditors = manuscriptRichTextEditors;
  window.manuscriptBlockRegistry = blockRegistry;
});


function setupServerPreview(form, manuscriptRoot) {
  if (!form?.dataset.previewUrl || !manuscriptRoot) return;

  let timer = null;
  let controller = null;
  let previewId = 0;
  let previewRevision = 0;
  let deferredManuscriptPreview = false;

  scheduleManuscriptPreview = ({ deferIfManuscriptFocused = false } = {}) => {
    previewRevision += 1;
    clearTimeout(timer);

    if (deferIfManuscriptFocused && focusedManuscriptRichText(manuscriptRoot)) {
      deferredManuscriptPreview = true;
      return;
    }

    deferredManuscriptPreview = false;
    timer = setTimeout(sendPreview, 500);
  };

  const flushDeferredPreview = () => {
    if (!deferredManuscriptPreview || focusedManuscriptRichText(manuscriptRoot)) return;
    scheduleManuscriptPreview();
  };

  const scheduleFromForm = (event) => {
    if (eventFromManuscriptRichText(event)) return;
    scheduleManuscriptPreview();
  };

  form.addEventListener("input", scheduleFromForm);
  form.addEventListener("change", scheduleFromForm);
  manuscriptRoot.addEventListener("focusout", () => { setTimeout(flushDeferredPreview, 0); });

  async function sendPreview() {
    const streamDocs = currentStreamDocs();
    writeStreamTextareas(streamDocs);

    if (controller) controller.abort();
    controller = new AbortController();
    const currentPreviewId = ++previewId;
    const requestRevision = previewRevision;

    try {
      const response = await fetch(form.dataset.previewUrl, {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
        signal: controller.signal,
      });
      const payload = await response.json();

      if (currentPreviewId !== previewId || requestRevision !== previewRevision) return;

      if (response.ok && payload.html) {
        window.manuscriptPreviewErrors = {};
        refreshArticlePreview(manuscriptRoot, payload.html, streamDocs);
      } else {
        window.manuscriptPreviewErrors = payload.errors || {};
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        window.manuscriptPreviewErrors = { preview: ["Preview failed."] };
      }
    }
  }
}

function focusedManuscriptRichText(manuscriptRoot) {
  const active = manuscriptRoot?.activeElement;
  return Boolean(active?.closest?.(".pm-manuscript-rich-text, .pm-manuscript-toolbar"));
}

function eventFromManuscriptRichText(event) {
  return (event.composedPath?.() || []).some((element) => (
    element?.classList?.contains("pm-manuscript-rich-text")
  ));
}

function currentStreamDocs() {
  const docs = new Map();

  for (const instance of editorInstances) {
    docs.set(instance.fieldName, applyManuscriptRichTextOverrides(instance.fieldName, instance.view.state.doc.toJSON()));
  }

  return docs;
}

function writeStreamTextareas(streamDocs = currentStreamDocs()) {
  for (const instance of editorInstances) {
    instance.textarea.value = JSON.stringify(pmDocToStreamValue(streamDocs.get(instance.fieldName)), null, 2);
  }
}

function refreshArticlePreview(manuscriptRoot, html, streamDocs) {
  const wrapper = manuscriptRoot.querySelector(".article-shadow-preview");
  if (!wrapper) return;

  for (const editor of manuscriptRichTextEditors) {
    editor.view.destroy();
  }
  manuscriptRichTextEditors.length = 0;

  articleEditorToolbar?.setView(null);

  wrapper.innerHTML = html;
  createManuscriptRichTextEditors(manuscriptRoot, streamDocs);
  createArticleBlockControls(manuscriptRoot);
  restoreSelectedArticleBlock(manuscriptRoot);
}

function setupMetadataTabs() {
  for (const tab of document.querySelectorAll("[data-metadata-tab]")) {
    tab.addEventListener("click", () => { selectMetadataTab(tab.dataset.metadataTab); });
  }
}

function selectMetadataTab(selected) {
  for (const tab of document.querySelectorAll("[data-metadata-tab]")) {
    tab.setAttribute("aria-selected", String(tab.dataset.metadataTab === selected));
  }
  for (const panel of document.querySelectorAll("[data-metadata-panel]")) {
    panel.hidden = panel.dataset.metadataPanel !== selected;
  }
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

function createEditorToolbar(root, { view = null, publishSource = null } = {}) {
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
      button.setAttribute("aria-pressed", String(Boolean(activeView && toolbarItemActive(activeView, key))));
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

    const href = normalizeLinkHref(rawHref);
    if (href === null) return false;

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

function normalizeLinkHref(value) {
  const href = String(value || "").trim();
  if (!href) return "";

  if (/^(javascript|data):/i.test(href)) {
    window.alert("Links cannot use javascript: or data: URLs.");
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || /^[#/?]/.test(href)) return href;
  return `https://${href}`;
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

function toolbarItemActive(view, key) {
  const { state } = view;
  const markNames = { bold: "strong", italic: "em", underline: "underline", link: "link" };
  const listNames = { bulletList: "bullet_list", orderedList: "ordered_list" };
  const mark = state.schema.marks[markNames[key]];
  const node = state.schema.nodes[listNames[key]];

  if (mark) return markActive(state, mark);
  if (node) return ancestorNodeActive(state, node);
  return false;
}

function markActive(state, mark) {
  const { from, $from, to, empty } = state.selection;
  return empty ? Boolean(mark.isInSet(state.storedMarks || $from.marks())) : state.doc.rangeHasMark(from, to, mark);
}

function ancestorNodeActive(state, nodeType) {
  const { from, $from, to } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type === nodeType) return true;
  }

  let found = false;
  if (to > from) {
    state.doc.nodesBetween(from, to, (node) => {
      if (node.type !== nodeType) return true;
      found = true;
      return false;
    });
  }
  return found;
}

function setupMetadataResize() {
  const editor = document.querySelector("[data-manuscript-editor]");
  const handle = document.querySelector("[data-metadata-resize-handle]");
  const aside = document.querySelector("[data-metadata-editor]");
  if (!editor || !handle || !aside) return;

  const setWidth = (width) => {
    const max = Math.min(1080, window.innerWidth - 180);
    editor.style.setProperty("--metadata-width", `${Math.max(280, Math.min(max, width))}px`);
  };

  setWidth(Number(localStorage.getItem("metadataEditorWidth")) || aside.getBoundingClientRect().width);

  handle.addEventListener("pointerdown", (event) => {
    handle.setPointerCapture(event.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (moveEvent) => {
      const width = editor.getBoundingClientRect().right - moveEvent.clientX;
      setWidth(width);
      localStorage.setItem("metadataEditorWidth", Math.round(width));
    };

    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });
}

function createStreamEditor(textarea, blockRegistry, streamValue) {
  const fieldName = textarea.dataset.streamField;
  const mount = document.querySelector(`[data-stream-editor="${window.CSS.escape(fieldName)}"]`);

  const content = streamValue.map(streamBlockToPmNode);
  const streamRegistry = blockRegistry?.byStreamField?.[fieldName] || {};
  const availableBlockTypes = Array.from(new Set([
    ...Object.keys(streamRegistry),
    ...streamValue.map((block) => block.type),
  ])).sort((a, b) => a.localeCompare(b));

  const doc = {
    type: "doc",
    content: content.length ? content : [createEmptyRichTextBlock()],
  };

  let sidebarToolbar;
  let view;
  view = new EditorView(mount, {
    state: EditorState.create({
      doc: streamSchema.nodeFromJSON(doc),
      plugins: editorPlugins(streamSchema),
    }),

    dispatchTransaction(transaction) {
      view.updateState(view.state.apply(transaction));
      sidebarToolbar?.update();
      refreshMoveControls(view);
      filterArticleEditorToBlock(selectedArticleBlock);
      if (transaction.docChanged) scheduleManuscriptPreview();
    },

    nodeViews: {
      stream_block(node, view, getPos) {
        return new StreamBlockView(node, view, getPos, {
          blockRegistry,
          streamFieldName: fieldName,
          availableBlockTypes,
        });
      },

      editable_field(node) {
        return new EditableFieldView(node);
      },

      list_field(node, view, getPos) {
        return new ListFieldView(node, view, getPos);
      },

      list_item(node, view, getPos) {
        return new ListItemView(node, view, getPos);
      },

      control_field(node, view, getPos) {
        return new ControlFieldView(node, view, getPos);
      },
    },
  });

  const toolbarMount = document.createElement("div");
  toolbarMount.className = "pm-sidebar-toolbar";
  mount.before(toolbarMount);
  sidebarToolbar = createEditorToolbar(toolbarMount, { view });

  const instance = {
    fieldName,
    textarea,
    view,
    mount,
    blockRegistry,
    availableBlockTypes,

    getJSON() {
      return view.state.doc.toJSON();
    },

    getStreamValue() {
      return pmDocToStreamValue(applyManuscriptRichTextOverrides(fieldName, view.state.doc.toJSON()));
    },

    writeBackToTextarea() {
      textarea.value = JSON.stringify(this.getStreamValue(), null, 2);
    },
  };

  editorInstances.push(instance);
  return instance;
}

function createManuscriptRichTextEditors(manuscriptRoot, streamDocs = null) {
  if (!manuscriptRoot) return;

  for (const instance of editorInstances) {
    const articleBlocks = Array.from(manuscriptRoot.querySelectorAll("[data-article-block]"))
      .filter((element) => element.dataset.streamField === instance.fieldName);
    const doc = streamDocs?.get(instance.fieldName) || instance.view.state.doc.toJSON();

    (doc.content || []).forEach((block, blockIndex) => {
      const field = (block.content || []).find((child) => (
        child.type === "editable_field" &&
        child.attrs?.mode === "richtext" &&
        JSON.stringify(child.attrs?.path || []) === "[]"
      ));

      if (block.attrs?.blockType !== "richtext" || !field || (block.content || []).some((child) => child.type === "control_field")) {
        return;
      }

      const blockId = block.attrs?.id;
      const articleBlock = (
        blockId && articleBlocks.find((element) => element.dataset.streamBlockId === String(blockId))
      ) || articleBlocks.find((element) => Number(element.dataset.streamBlockIndex) === blockIndex);

      if (!articleBlock) return;

      let view;
      view = new EditorView({ mount: articleBlock }, {
        state: EditorState.create({
          doc: richTextSchema.nodeFromJSON({
            type: "doc",
            content: field.content?.length ? field.content : [{ type: "paragraph" }],
          }),
          plugins: editorPlugins(richTextSchema),
        }),

        dispatchTransaction(transaction) {
          view.updateState(view.state.apply(transaction));
          articleEditorToolbar?.update();
          if (transaction.docChanged) scheduleManuscriptPreview({ deferIfManuscriptFocused: true });
        },

        attributes: {
          class: `${articleBlock.className} pm-manuscript-rich-text`,
        },
      });

      view.dom.addEventListener("focus", () => { articleEditorToolbar?.setView(view); }, true);

      manuscriptRichTextEditors.push({
        fieldName: instance.fieldName,
        blockId,
        blockIndex,
        view,
      });
    });
  }
}

const ARTICLE_BLOCK_SELECTOR = "[data-article-block][data-stream-field]";
const ARTICLE_STREAM_FIELDS = new Set(["header", "content"]);
const ARTICLE_KEY_DIRECTIONS = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};

function createArticleBlockControls(manuscriptRoot) {
  if (!manuscriptRoot) return;

  articleBlockControlsState?.cleanup?.();
  articleBlockControlsState = null;
  manuscriptRoot.querySelectorAll(".pm-article-block-controls, .pm-article-block-controls-layer").forEach((element) => { element.remove(); });
  if (!manuscriptRoot.querySelector(ARTICLE_BLOCK_SELECTOR)) return;

  const element = (tag, className) => Object.assign(document.createElement(tag), { className });

  const layer = element("div", "pm-article-block-controls-layer");
  const outline = element("div", "pm-article-block-outline");
  const controls = element("div", "pm-article-block-controls");
  const select = element("select", "pm-article-block-controls__select");
  const buttons = {};

  select.setAttribute("aria-label", "Block type to insert");
  controls.appendChild(select);

  const addButton = (key, label, title, callback, extraClass = "") => {
    buttons[key] = makeButton(label, () => {
      const { instance, articleBlock } = articleBlockControlsState || {};
      if (instance && articleBlock) callback(instance, articleBlock, select.value);
    }, title, `pm-article-block-controls__button ${extraClass}`.trim());
    controls.appendChild(buttons[key]);
  };

  [
    ["insert", "+", "Insert after", insertStreamBlockAfter],
    ["up", "↑", "Move up", (instance, articleBlock) => { moveArticleStreamBlock(instance, articleBlock, -1); }],
    ["down", "↓", "Move down", (instance, articleBlock) => { moveArticleStreamBlock(instance, articleBlock, 1); }],
    ["delete", "Del", "Delete", deleteArticleStreamBlock, "pm-article-block-controls__button--danger"],
  ].forEach((args) => { addButton(...args); });

  layer.appendChild(outline);
  layer.appendChild(controls);
  manuscriptRoot.appendChild(layer);

  const state = {
    articleBlock: null,
    instance: null,
    hideTimer: null,

    cleanup() {
      clearTimeout(this.hideTimer);
      for (const [target, eventName, listener, options] of listeners) {
        target.removeEventListener(eventName, listener, options);
      }
      layer.remove();
    },

    hide() {
      clearTimeout(this.hideTimer);
      this.articleBlock = null;
      this.instance = null;
      layer.classList.remove("is-active");
    },

    setActive(articleBlock) {
      const instance = editorInstances.find((item) => item.fieldName === articleBlock.dataset.streamField);
      const info = instance && streamBlockInfoForArticleBlock(instance, articleBlock);
      if (!instance || !info) {
        this.hide();
        return;
      }

      clearTimeout(this.hideTimer);
      this.articleBlock = articleBlock;
      this.instance = instance;
      fillSelect(instance);
      buttons.up.disabled = info.index === 0;
      buttons.down.disabled = info.index === instance.view.state.doc.childCount - 1;
      positionControls();
    },
  };

  select.addEventListener("change", () => {
    if (state.instance) articleInsertBlockTypes.set(state.instance.fieldName, select.value);
  });

  const fillSelect = (instance) => {
    const blockTypes = instance.availableBlockTypes || [];
    const preferredValue = articleInsertBlockTypes.get(instance.fieldName);
    const currentValue = select.value;

    select.replaceChildren(...blockTypes.map((blockType) => {
      const option = document.createElement("option");
      option.value = blockType;
      option.textContent = blockType;
      return option;
    }));

    const nextValue = [preferredValue, currentValue, blockTypes[0]].find((value) => value && blockTypes.includes(value));
    if (nextValue) {
      select.value = nextValue;
      articleInsertBlockTypes.set(instance.fieldName, nextValue);
    }
  };

  const positionControls = () => {
    if (!state.articleBlock) return;

    const rect = state.articleBlock.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      state.hide();
      return;
    }

    const offset = 4;
    const padding = 6;
    layer.classList.add("is-active");
    Object.assign(outline.style, {
      left: `${rect.left - offset}px`,
      top: `${rect.top - offset}px`,
      width: `${rect.width + (offset * 2)}px`,
      height: `${rect.height + (offset * 2)}px`,
    });

    Object.assign(controls.style, { left: "0px", top: "0px" });
    const controlsRect = controls.getBoundingClientRect();
    const left = Math.max(padding, Math.min(rect.left - offset, window.innerWidth - controlsRect.width - padding));
    const topCandidate = rect.top - offset - controlsRect.height;
    const top = Math.max(padding, Math.min(
      topCandidate < padding ? rect.top + offset : topCandidate,
      window.innerHeight - controlsRect.height - padding,
    ));
    Object.assign(controls.style, { left: `${left}px`, top: `${top}px` });
  };

  const insideActiveArea = (target) => Boolean(target && (
    controls.contains(target) || state.articleBlock?.contains(target)
  ));

  const showFromTarget = (target, shouldSelect = false) => {
    if (controls.contains(target)) {
      clearTimeout(state.hideTimer);
      return;
    }

    const articleBlock = target.closest?.(ARTICLE_BLOCK_SELECTOR);
    if (!articleBlock) return;

    if (!shouldSelect && articleBlock === suppressedArticleHoverBlock) return;
    if (shouldSelect || articleBlock !== suppressedArticleHoverBlock) clearSuppressedArticleHover();

    state.setActive(articleBlock);
    if (shouldSelect) selectArticleBlock(articleBlock);
  };

  const scheduleHide = () => {
    clearTimeout(state.hideTimer);
    state.hideTimer = setTimeout(() => {
      if (!insideActiveArea(manuscriptRoot.activeElement)) state.hide();
    }, 120);
  };

  const onOver = (event) => { showFromTarget(event.target); };
  const onFocusIn = (event) => { showFromTarget(event.target, true); };
  const onClick = (event) => { showFromTarget(event.target, true); };
  const onOut = (event) => {
    if (suppressedArticleHoverBlock?.contains(event.target) && !suppressedArticleHoverBlock.contains(event.relatedTarget)) {
      clearSuppressedArticleHover();
    }
    if (insideActiveArea(event.target) && !insideActiveArea(event.relatedTarget)) scheduleHide();
  };
  const onFocusOut = () => { setTimeout(scheduleHide, 0); };
  const listeners = [
    [manuscriptRoot, "mouseover", onOver],
    [manuscriptRoot, "focusin", onFocusIn],
    [manuscriptRoot, "click", onClick],
    [manuscriptRoot, "mouseout", onOut],
    [manuscriptRoot, "focusout", onFocusOut],
    [window, "scroll", positionControls, true],
    [window, "resize", positionControls],
  ];

  for (const [target, eventName, listener, options] of listeners) {
    target.addEventListener(eventName, listener, options);
  }

  articleBlockControlsState = state;
}

function hideArticleBlockControls() {
  articleBlockControlsState?.hide();
}

function streamBlockInfoForArticleBlock(instance, articleBlock) {
  const blockId = articleBlock.dataset.streamBlockId;
  const blockIndex = Number(articleBlock.dataset.streamBlockIndex);
  return streamBlockInfo(instance.view.state.doc, ({ node, index }) => (
    (blockId && node.attrs?.id === blockId) || (!blockId && index === blockIndex)
  ));
}

function streamBlockInfo(doc, matches) {
  let start = 0;
  for (let index = 0; index < doc.childCount; index += 1) {
    const node = doc.child(index);
    const end = start + node.nodeSize;
    if (matches({ node, index, start, end })) {
      return { node, index, start, end };
    }
    start = end;
  }
  return null;
}

function createStreamBlockNode(instance, blockType) {
  const blockDefinition = instance.blockRegistry?.byStreamField?.[instance.fieldName]?.[blockType] || {};
  const defaultValue = blockDefinition.defaultValue !== undefined ? blockDefinition.defaultValue : "";
  return streamSchema.nodeFromJSON(streamBlockToPmNode({
    type: blockType,
    id: uuidv4(),
    value: clone(defaultValue),
    fields: clone(blockDefinition.defaultFields || []),
  }));
}

function insertStreamBlockAfter(instance, articleBlock, blockType) {
  const info = streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!info || !blockType) return;

  const newBlock = createStreamBlockNode(instance, blockType);
  const descriptor = {
    fieldName: instance.fieldName,
    blockId: newBlock.attrs?.id || "",
    blockIndex: info.index + 1,
  };

  suppressArticleHover(articleBlock);
  selectedArticleBlock = descriptor;
  instance.view.dispatch(instance.view.state.tr.insert(info.end, newBlock));
  selectArticleBlockDescriptor(descriptor, articleBlock.getRootNode());
  hideArticleBlockControls();
}

function moveArticleStreamBlock(instance, articleBlock, direction) {
  const info = streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!info) return;

  const targetIndex = info.index + direction;
  if (targetIndex < 0 || targetIndex >= instance.view.state.doc.childCount) return;

  const blocks = [];
  for (let index = 0; index < instance.view.state.doc.childCount; index += 1) {
    blocks.push(instance.view.state.doc.child(index));
  }

  [blocks[info.index], blocks[targetIndex]] = [blocks[targetIndex], blocks[info.index]];
  instance.view.dispatch(instance.view.state.tr.replaceWith(
    0,
    instance.view.state.doc.content.size,
    Fragment.fromArray(blocks),
  ));
  moveArticleBlockElement(articleBlock, direction);
}

function deleteArticleStreamBlock(instance, articleBlock) {
  const info = streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!info) return;

  const { doc, tr } = instance.view.state;
  selectedArticleBlock = null;
  if (doc.childCount <= 1) {
    instance.view.dispatch(tr.replaceWith(info.start, info.end, streamSchema.nodeFromJSON(createEmptyRichTextBlock())));
    filterArticleEditorToBlock(null);
    hideArticleBlockControls();
    return;
  }

  instance.view.dispatch(tr.delete(info.start, info.end));
  removeArticleBlockElement(articleBlock);
  filterArticleEditorToBlock(null);
  hideArticleBlockControls();
}

function streamFieldArticleBlocks(root, fieldName) {
  return Array.from(root.querySelectorAll(`${ARTICLE_BLOCK_SELECTOR}[data-stream-field="${window.CSS.escape(fieldName)}"]`));
}

function refreshArticleBlockIndexes(root, fieldName) {
  streamFieldArticleBlocks(root, fieldName).forEach((block, index) => {
    block.dataset.streamBlockIndex = index;
  });
}

function moveArticleBlockElement(articleBlock, direction) {
  const root = articleBlock.getRootNode();
  const fieldName = articleBlock.dataset.streamField;
  const articleBlocks = streamFieldArticleBlocks(root, fieldName);
  const target = articleBlocks[articleBlocks.indexOf(articleBlock) + direction];
  if (!target) return;

  if (direction < 0) target.before(articleBlock);
  else target.after(articleBlock);

  refreshArticleBlockIndexes(root, fieldName);
  articleBlockControlsState?.setActive?.(articleBlock);
  selectArticleBlock(articleBlock);
}

function removeArticleBlockElement(articleBlock) {
  const root = articleBlock.getRootNode();
  const fieldName = articleBlock.dataset.streamField;
  articleBlock.remove();
  refreshArticleBlockIndexes(root, fieldName);
}

function selectArticleBlock(articleBlock) {
  selectArticleBlockDescriptor(articleBlockDescriptor(articleBlock), articleBlock.getRootNode());
}

function selectArticleBlockDescriptor(descriptor, manuscriptRoot = null, options = {}) {
  if (!descriptor) return false;

  selectedArticleBlock = descriptor;
  selectMetadataTab("article");
  filterArticleEditorToBlock(descriptor);

  const articleBlock = manuscriptRoot && articleBlockFromDescriptor(manuscriptRoot, descriptor);
  if (articleBlock) {
    articleBlockControlsState?.setActive?.(articleBlock);
    if (options.reveal) articleBlock.scrollIntoView({ block: "nearest" });
  }

  return true;
}

function articleBlockDescriptor(articleBlock) {
  const instance = editorInstances.find((item) => item.fieldName === articleBlock.dataset.streamField);
  const info = instance && streamBlockInfoForArticleBlock(instance, articleBlock);
  if (!instance || !info) return null;

  return {
    fieldName: instance.fieldName,
    blockId: info.node.attrs?.id || articleBlock.dataset.streamBlockId || "",
    blockIndex: info.index,
  };
}

function restoreSelectedArticleBlock(manuscriptRoot) {
  const articleBlock = selectedArticleBlock && articleBlockFromDescriptor(manuscriptRoot, selectedArticleBlock);
  if (articleBlock) {
    selectedArticleBlock = articleBlockDescriptor(articleBlock) || selectedArticleBlock;
  } else if (selectedArticleBlock && !articleBlockDescriptors().some((item) => sameArticleBlockDescriptor(item, selectedArticleBlock))) {
    selectedArticleBlock = null;
  }

  filterArticleEditorToBlock(selectedArticleBlock);
}

function articleBlockFromDescriptor(root, descriptor) {
  const blocks = streamFieldArticleBlocks(root, descriptor.fieldName);
  return (
    descriptor.blockId && blocks.find((block) => block.dataset.streamBlockId === String(descriptor.blockId))
  ) || blocks[descriptor.blockIndex] || null;
}

function filterArticleEditorToBlock(descriptor) {
  for (const instance of editorInstances) {
    if (!ARTICLE_STREAM_FIELDS.has(instance.fieldName)) continue;

    const section = instance.mount.closest(".editor-section");
    const isSelectedField = descriptor?.fieldName === instance.fieldName;
    if (section) section.hidden = Boolean(descriptor && !isSelectedField);

    const blocks = Array.from(instance.mount.querySelectorAll(".pm-stream-block"));
    const selectedBlock = isSelectedField ? selectedEditorBlock(blocks, descriptor) : null;
    blocks.forEach((block) => {
      block.hidden = Boolean(descriptor && block !== selectedBlock);
    });
  }
}

function selectedEditorBlock(blocks, descriptor) {
  return (
    descriptor.blockId && blocks.find((block) => block.dataset.streamBlockId === String(descriptor.blockId))
  ) || blocks.find((block) => Number(block.dataset.streamBlockIndex) === descriptor.blockIndex) || null;
}

function suppressArticleHover(articleBlock) {
  clearSuppressedArticleHover();
  suppressedArticleHoverBlock = articleBlock;
  suppressedArticleHoverTimer = setTimeout(() => {
    if (suppressedArticleHoverBlock === articleBlock) clearSuppressedArticleHover();
  }, 1200);
}

function clearSuppressedArticleHover() {
  if (suppressedArticleHoverTimer) clearTimeout(suppressedArticleHoverTimer);
  suppressedArticleHoverTimer = null;
  suppressedArticleHoverBlock = null;
}

function setupArticleBlockKeyboard(manuscriptRoot) {
  document.addEventListener("keydown", (event) => {
    const direction = ARTICLE_KEY_DIRECTIONS[event.key];
    const isEditing = (event.composedPath?.() || []).some((element) => (
      ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(element?.nodeName) ||
      element?.isContentEditable ||
      element?.classList?.contains("ProseMirror")
    ));

    if (
      !direction || isEditing || event.defaultPrevented ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    ) return;

    if (selectAdjacentArticleBlock(direction, manuscriptRoot)) event.preventDefault();
  });
}

function selectAdjacentArticleBlock(direction, manuscriptRoot) {
  const descriptors = articleBlockDescriptors();
  if (!descriptors.length) return false;

  const currentIndex = selectedArticleBlock
    ? descriptors.findIndex((descriptor) => sameArticleBlockDescriptor(descriptor, selectedArticleBlock))
    : -1;
  const nextIndex = currentIndex < 0
    ? (direction > 0 ? 0 : descriptors.length - 1)
    : Math.max(0, Math.min(descriptors.length - 1, currentIndex + direction));

  if (nextIndex === currentIndex) return false;
  clearSuppressedArticleHover();
  return selectArticleBlockDescriptor(descriptors[nextIndex], manuscriptRoot, { reveal: true });
}

function articleBlockDescriptors() {
  const descriptors = [];

  for (const fieldName of ARTICLE_STREAM_FIELDS) {
    const instance = editorInstances.find((item) => item.fieldName === fieldName);
    if (!instance) continue;

    for (let blockIndex = 0; blockIndex < instance.view.state.doc.childCount; blockIndex += 1) {
      const node = instance.view.state.doc.child(blockIndex);
      descriptors.push({
        fieldName,
        blockId: node.attrs?.id || "",
        blockIndex,
      });
    }
  }

  return descriptors;
}

function sameArticleBlockDescriptor(left, right) {
  if (!left || !right || left.fieldName !== right.fieldName) return false;
  return left.blockId || right.blockId ? left.blockId === right.blockId : left.blockIndex === right.blockIndex;
}

function applyManuscriptRichTextOverrides(fieldName, pmDoc) {
  const nextDoc = clone(pmDoc);
  const blocks = nextDoc.content || [];

  for (const editor of manuscriptRichTextEditors.filter((item) => item.fieldName === fieldName)) {
    const block = (
      editor.blockId && blocks.find((node) => node.attrs?.id === editor.blockId)
    ) || (!editor.blockId && blocks[editor.blockIndex]);
    const field = (block?.content || []).find((child) => child.type === "editable_field" && child.attrs?.mode === "richtext");

    if (field) {
      field.content = editor.view.state.doc.toJSON().content || [{ type: "paragraph" }];
    }
  }

  return nextDoc;
}

function pmDocToStreamValue(pmDoc) {
  return (pmDoc.content || [])
    .filter((node) => node.type === "stream_block")
    .map(pmStreamBlockToWagtailBlock);
}

// Wagtail -> Prosemirror
function createEmptyRichTextBlock() {
  return streamBlockToPmNode({
    type: "richtext",
    id: uuidv4(),
    value: "",
    fields: [{
      kind: "editable",
      path: [],
      label: "Rich text",
      mode: "richtext",
      value: "",
    }],
  });
}

function streamBlockToPmNode(block) {
  const blockType = block?.type || "unknown";

  return {
    type: "stream_block",
    attrs: {
      id: block?.id || uuidv4(),
      blockType,
      originalValue: clone(block?.value),
    },
    content: (block?.fields || []).map((field) => fieldToPmNode(field, blockType)),
  };
}

function fieldToPmNode(field, blockType = null) {
  if (field.kind === "list") {
    return {
      type: "list_field",
      attrs: {
        path: field.path,
        label: field.label,
        itemValue: field.itemValue,
        itemFields: field.itemFields || [],
      },
      content: (field.items || []).map((item) => listItemToPmNode(field, item)),
    };
  }

  if (field.kind === "control") {
    return {
      type: "control_field",
      attrs: {
        path: field.path,
        label: field.label,
        controlType: field.controlType,
        value: field.value,
        options: field.options || null,
      },
    };
  }

  return {
    type: "editable_field",
    attrs: {
      path: field.path,
      label: field.label,
      mode: field.mode,
      manuscriptOwned: blockType === "richtext" && field.mode === "richtext" && JSON.stringify(field.path || []) === "[]",
    },
    content: field.mode === "plain_text" ? plainTextToPmContent(field.value) : richTextToPmContent(field.value),
  };
}

function listItemToPmNode(field, item = null) {
  const value = item ? item.value : clone(field.itemValue);
  return {
    type: "list_item",
    attrs: { originalValue: clone(value) },
    content: ((item && item.fields) || field.itemFields || []).map(fieldToPmNode),
  };
}

function plainTextToPmContent(value) {
  const text = String(value || "");

  if (!text.trim()) {
    return [{ type: "paragraph" }];
  }

  return text.split(/\n{2,}/).map((paragraphText) => ({
    type: "paragraph",
    content: paragraphText ? [{ type: "text", text: paragraphText }] : undefined,
  }));
}

function richTextToPmContent(value) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = value || "";
  stripEditorChrome(wrapper);

  const json = DOMParser.fromSchema(richTextSchema).parse(wrapper).toJSON();
  return Array.isArray(json.content) && json.content.length ? json.content : [{ type: "paragraph" }];
}

function stripEditorChrome(wrapper) {
  wrapper.querySelectorAll(RICH_TEXT_CHROME_SELECTORS.join(",")).forEach((element) => {
    element.remove();
  });

  wrapper.querySelectorAll(RICH_TEXT_WRAPPER_SELECTORS.join(",")).forEach((element) => {
    element.replaceWith(...Array.from(element.childNodes));
  });
}

// Prosemirror -> Wagtail
function pmStreamBlockToWagtailBlock(node) {
  const attrs = node.attrs || {};
  const block = {
    type: attrs.blockType || "unknown",
    value: clone(attrs.originalValue),
  };

  if (attrs.id) {
    block.id = attrs.id;
  }

  for (const childNode of node.content || []) {
    const fieldAttrs = childNode.attrs || {};
    const path = Array.isArray(fieldAttrs.path) ? fieldAttrs.path : [];

    if (childNode.type === "editable_field") {
      setBlockValue(block, path, editableFieldValue(childNode, fieldAttrs.mode));
    } else if (childNode.type === "control_field") {
      setBlockValue(block, path, controlFieldValue(fieldAttrs, getValueAtPath(block.value, path)));
    } else if (childNode.type === "list_field") {
      setBlockValue(block, path, listFieldValue(childNode));
    }
  }

  return block;
}

function listFieldValue(node) {
  return (node.content || [])
    .filter((item) => item.type === "list_item")
    .map((item) => listItemValue(item, node.attrs || {}));
}

function listItemValue(node, listAttrs) {
  let value = clone(node.attrs?.originalValue);
  if (value === undefined) value = clone(listAttrs.itemValue);

  for (const childNode of node.content || []) {
    const fieldAttrs = childNode.attrs || {};
    const path = Array.isArray(fieldAttrs.path) ? fieldAttrs.path : [];

    if (childNode.type === "editable_field") {
      value = setFieldValue(value, path, editableFieldValue(childNode, fieldAttrs.mode));
    } else if (childNode.type === "control_field") {
      value = setFieldValue(value, path, controlFieldValue(fieldAttrs, getValueAtPath(value, path)));
    } else if (childNode.type === "list_field") {
      value = setFieldValue(value, path, listFieldValue(childNode));
    }
  }

  return value;
}

function editableFieldValue(node, mode = "richtext") {
  if (mode === "plain_text") {
    return (node.content || [])
      .map((pmBlock) => streamSchema.nodeFromJSON(pmBlock).textContent)
      .join("\n\n");
  }

  const richTextNodes = (node.content || [])
    .filter((block) => !["stream_block", "editable_field", "control_field"].includes(block.type))
    .map((block) => richTextSchema.nodeFromJSON(block));
  const domFragment = DOMSerializer
    .fromSchema(richTextSchema)
    .serializeFragment(Fragment.fromArray(richTextNodes));
  const wrapper = document.createElement("div");
  wrapper.appendChild(domFragment);
  return wrapper.innerHTML;
}

function controlFieldValue(fieldAttrs, originalValue) {
  let value = fieldAttrs.value;
  const controlType = fieldAttrs.controlType || "text";

  if (controlType === "boolean") {
    value = Boolean(value);
  }

  if (["image", "document"].includes(controlType) && value === "") {
    value = null;
  }

  if (controlType === "number") {
    value = value === "" || value == null ? null : Number(value);
  }

  return Array.isArray(originalValue) ? [value] : value;
}

function setBlockValue(block, path, value) {
  block.value = setFieldValue(block.value, path, value);
}

function setFieldValue(root, path, value) {
  if (path.length === 0) return value;
  setValueAtPath(root, path, value);
  return root;
}

function getValueAtPath(root, path) {
  let current = root;

  for (const key of path) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

function setValueAtPath(root, path, value) {
  let current = root;

  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];

    if (current == null || typeof current !== "object") {
      return;
    }

    current = current[key];
  }

  const finalKey = path[path.length - 1];

  if (current && typeof current === "object") {
    current[finalKey] = value;
  }
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function readJsonScript(id) {
  return JSON.parse(document.getElementById(id).textContent) || {};
}