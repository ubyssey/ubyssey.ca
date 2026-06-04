//
// Handles Prosemirror/Wagtail Integration Stuff
//

import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema, DOMParser, DOMSerializer, Fragment } from "prosemirror-model";
import { v4 as uuidv4 } from "uuid";

import {
  baseNodesWithLists,
  createEditorToolbar,
  editorPlugins,
  makeButton,
  marks,
  richTextSchema,
} from "../prosemirror/base";

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

const RICH_TEXT_WRAPPER_SELECTORS = [
  ".pm-stream-block",
  ".pm-stream-block__content",
  ".pm-editable-field",
  ".pm-editable-field__content",
];

const streamNodes = baseNodesWithLists.remove("doc").append({
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

export const streamSchema = new Schema({
  nodes: streamNodes,
  marks,
});

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
    const pmNode = createStreamBlockNodeFromRegistry(this.blockRegistry, this.streamFieldName, blockType);
    const insertPos = pos + this.node.nodeSize;
    const tr = this.view.state.tr.insert(insertPos, pmNode);
    this.view.dispatch(tr);
    this.view.focus();
  }

  deleteBlock() {
    const pos = this.getPos();
    const { doc, tr } = this.view.state;

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

export function createStreamEditor(textarea, blockRegistry, streamValue, options = {}) {
  const {
    createToolbar = createEditorToolbar,
    getDocForSave = (_, doc) => doc,
    onDocChanged = () => {},
    onTransaction = () => {},
  } = options;
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

  let instance;
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
      onTransaction({ transaction, instance, view });
      if (transaction.docChanged) onDocChanged({ transaction, instance, view });
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
  sidebarToolbar = createToolbar(toolbarMount, { view });

  instance = {
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
      return pmDocToStreamValue(getDocForSave(fieldName, view.state.doc.toJSON()));
    },

    writeBackToTextarea() {
      textarea.value = JSON.stringify(this.getStreamValue(), null, 2);
    },
  };

  return instance;
}

export function createStreamBlockNode(instance, blockType) {
  return createStreamBlockNodeFromRegistry(instance.blockRegistry, instance.fieldName, blockType);
}

function createStreamBlockNodeFromRegistry(blockRegistry, fieldName, blockType) {
  const blockDefinition = blockRegistry?.byStreamField?.[fieldName]?.[blockType] || {};
  const defaultValue = blockDefinition.defaultValue !== undefined ? blockDefinition.defaultValue : "";
  return streamSchema.nodeFromJSON(streamBlockToPmNode({
    type: blockType,
    id: uuidv4(),
    value: clone(defaultValue),
    fields: clone(blockDefinition.defaultFields || []),
  }));
}

export function pmDocToStreamValue(pmDoc) {
  return (pmDoc.content || [])
    .filter((node) => node.type === "stream_block")
    .map(pmStreamBlockToWagtailBlock);
}

export function createEmptyRichTextBlock() {
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

  let content;
  if (field.mode === "plain_text") {
    const text = String(field.value || "");
    content = text.trim()
      ? text.split(/\n{2,}/).map((paragraphText) => ({
        type: "paragraph",
        content: paragraphText ? [{ type: "text", text: paragraphText }] : undefined,
      }))
      : [{ type: "paragraph" }];
  } else {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = field.value || "";
    wrapper.querySelectorAll(RICH_TEXT_CHROME_SELECTORS.join(",")).forEach((element) => {
      element.remove();
    });
    wrapper.querySelectorAll(RICH_TEXT_WRAPPER_SELECTORS.join(",")).forEach((element) => {
      element.replaceWith(...Array.from(element.childNodes));
    });

    const json = DOMParser.fromSchema(richTextSchema).parse(wrapper).toJSON();
    content = Array.isArray(json.content) && json.content.length ? json.content : [{ type: "paragraph" }];
  }

  return {
    type: "editable_field",
    attrs: {
      path: field.path,
      label: field.label,
      mode: field.mode,
      manuscriptOwned: blockType === "richtext" && field.mode === "richtext" && JSON.stringify(field.path || []) === "[]",
    },
    content,
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

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

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
    .map((item) => {
      let value = clone(item.attrs?.originalValue);
      if (value === undefined) value = clone(node.attrs?.itemValue);

      for (const childNode of item.content || []) {
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
    });
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

  let current = root;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    if (current == null || typeof current !== "object") return root;
    current = current[key];
  }

  const finalKey = path[path.length - 1];
  if (current && typeof current === "object") current[finalKey] = value;
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
