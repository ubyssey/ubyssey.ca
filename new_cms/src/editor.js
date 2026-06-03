import "prosemirror-view/style/prosemirror.css";
import "prosemirror-menu/style/menu.css";
import "prosemirror-example-setup/style/style.css";
import "prosemirror-gapcursor/style/gapcursor.css";

import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema, DOMParser, DOMSerializer, Fragment } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import { exampleSetup } from "prosemirror-example-setup";
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

const marks = basicSchema.spec.marks.append({});

const richTextSchema = new Schema({
  nodes: baseNodesWithLists,
  marks,
});

const streamSchema = new Schema({
  nodes,
  marks,
});

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

  const toolbar = manuscriptRoot.querySelector(".pm-manuscript-toolbar");
  if (toolbar) toolbar.replaceChildren();

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

  let view;
  view = new EditorView(mount, {
    state: EditorState.create({
      doc: streamSchema.nodeFromJSON(doc),
      plugins: exampleSetup({
        schema: streamSchema,
      }),
    }),

    dispatchTransaction(transaction) {
      view.updateState(view.state.apply(transaction));
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

  const toolbar = manuscriptRoot.querySelector(".pm-manuscript-toolbar");

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
          plugins: exampleSetup({ schema: richTextSchema, floatingMenu: false }),
        }),

        dispatchTransaction(transaction) {
          view.updateState(view.state.apply(transaction));
          if (transaction.docChanged) scheduleManuscriptPreview({ deferIfManuscriptFocused: true });
        },

        attributes: {
          class: `${articleBlock.className} pm-manuscript-rich-text`,
        },
      });

      const wrapper = view.dom.parentNode;
      const menu = wrapper?.querySelector(".ProseMirror-menubar");
      if (toolbar && menu) {
        wrapper.style.minHeight = "";
        menu.style.minHeight = "";
        for (const use of menu.querySelectorAll("use")) {
          const id = (use.href?.baseVal || "").split("#")[1];
          const symbol = id && (manuscriptRoot.getElementById(id) || document.getElementById(id));
          const svg = use.closest("svg");
          if (symbol && svg) {
            svg.setAttribute("viewBox", symbol.getAttribute("viewBox"));
            svg.replaceChildren(...Array.from(symbol.childNodes).map((node) => node.cloneNode(true)));
          }
        }
        menu.hidden = toolbar.children.length > 0;
        toolbar.appendChild(menu);
        view.dom.addEventListener("focus", () => {
          Array.from(toolbar.children).forEach((child) => { child.hidden = true; });
          menu.hidden = false;
        }, true);
      }

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