// Prosemirror and Wagtail Schema Integration

import { Schema, Fragment } from "prosemirror-model";
import { baseNodesWithLists, marks, makeButton } from "./prosemirror_base";
import { createEmptyRichTextBlock, createStreamBlockNodeFromRegistry, listItemToPmNode } from "./stream_serialization";

// Document Schema
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
      blockComments: { default: [] },
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


export function topLevelBlockInfo(doc, matcher) {
  let offset = 0;

  for (let index = 0; index < doc.childCount; index += 1) {
    const node = doc.child(index);
    const start = offset;
    const end = start + node.nodeSize;

    if (matcher({ node, index, start, end })) {
      return { node, index, start, end };
    }

    offset = end;
  }

  return null;
}

export function topLevelBlockInfoAtPos(doc, pos) {
  return topLevelBlockInfo(doc, ({ start }) => pos === start);
}

export function topLevelBlockInfoByIdOrIndex(doc, blockId, blockIndex) {
  const byId = blockId && topLevelBlockInfo(doc, ({ node }) => node.attrs?.id === blockId);
  return byId || topLevelBlockInfo(doc, ({ index }) => index === blockIndex);
}

export function moveTopLevelBlock(view, fromIndex, direction) {
  const targetIndex = fromIndex + direction;
  if (targetIndex < 0 || targetIndex >= view.state.doc.childCount) return false;

  const blocks = [];
  for (let index = 0; index < view.state.doc.childCount; index += 1) {
    blocks.push(view.state.doc.child(index));
  }

  [blocks[fromIndex], blocks[targetIndex]] = [blocks[targetIndex], blocks[fromIndex]];
  view.dispatch(view.state.tr.replaceWith(
    0,
    view.state.doc.content.size,
    Fragment.fromArray(blocks),
  ));
  return true;
}

export function deleteTopLevelBlock(view, info) {
  const { doc, tr } = view.state;

  if (doc.childCount <= 1) {
    view.dispatch(tr.replaceWith(info.start, info.end, streamSchema.nodeFromJSON(createEmptyRichTextBlock())));
    return "replaced";
  }

  view.dispatch(tr.delete(info.start, info.end));
  return "deleted";
}

export function refreshMoveControls(view) {
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

// Overarching container block type that handles inserts/moves/deletes
export class StreamBlockView {
  constructor(node, view, getPos, options = {}) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.blockTypes = options.blockTypes || {};
    this.availableBlockTypes = options.availableBlockTypes || [];

    this.dom = document.createElement("section");
    this.dom.className = "pm-stream-block";
    this.dom.dataset.blockType = node.attrs.blockType || "";
    this.dom.dataset.streamBlockId = node.attrs.id || "";
    this.dom.dataset.streamBlockIndex = "";

    this.header = document.createElement("div");
    this.header.className = "pm-stream-block__header";


    this.controls = this.createControls();

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
    const pmNode = createStreamBlockNodeFromRegistry(this.blockTypes, blockType);
    const insertPos = pos + this.node.nodeSize;
    const tr = this.view.state.tr.insert(insertPos, pmNode);
    this.view.dispatch(tr);
    this.view.focus();
  }

  deleteBlock() {
    const info = topLevelBlockInfoAtPos(this.view.state.doc, this.getPos());
    if (!info) return;

    deleteTopLevelBlock(this.view, info);
    this.view.focus();
  }

  moveBlock(direction) {
    const info = topLevelBlockInfoAtPos(this.view.state.doc, this.getPos());
    if (info && moveTopLevelBlock(this.view, info.index, direction)) this.view.focus();
  }

  refreshUI(node) {
    const blockId = node.attrs.id || "";
    this.dom.dataset.blockType = node.attrs.blockType || "";
    this.dom.dataset.streamBlockId = blockId;

    const pos = this.getPos();
    const info = topLevelBlockInfoAtPos(this.view.state.doc, pos);

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

export class EditableFieldView {
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

export class ListFieldView {
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

export class ListItemView {
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

function articleMediaOptions(kind) {
  return Array.from(document.querySelectorAll(`[data-article-media-item][data-kind="${window.CSS.escape(kind)}"]`))
    .map((item) => ({ value: item.dataset.id, label: item.dataset.title }));
}

export class ControlFieldView {
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

  // Custom input creation by type
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
      const select = document.createElement("select");
      const options = articleMediaOptions(controlType);
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = controlType === "image" ? "No image" : "No document";
      select.appendChild(blank);

      for (const option of options) {
        const optionElement = document.createElement("option");
        optionElement.value = String(option.value);
        optionElement.textContent = option.label;
        select.appendChild(optionElement);
      }

      if (value && !options.some((option) => String(option.value) === String(value))) {
        const current = document.createElement("option");
        current.value = String(value);
        current.textContent = `${controlType} #${value}`;
        select.appendChild(current);
      }

      select.value = value ?? "";
      select.addEventListener("change", () => {
        const nextValue = select.value ? Number(select.value) : null;
        this.updateValue(Number.isNaN(nextValue) ? null : nextValue);
      });

      return select;
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
