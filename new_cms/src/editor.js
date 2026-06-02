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
  ".pm-editable-field__label",
];

// Should be deleted before save, but contents should remain
const RICH_TEXT_WRAPPER_SELECTORS = [
  ".pm-stream-block",
  ".pm-stream-block__content",
  ".pm-editable-field",
  ".pm-editable-field__content",
];

const mediaCache = new Map();

async function fetchMedia(type, id) {
  const kind = type === "image" ? "images" : "documents";
  const key = `${kind}:${id}`;

  if (!mediaCache.has(key)) {
    mediaCache.set(key, fetch(`/new-cms/api/v2/${kind}/${encodeURIComponent(id)}/`, { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : null)
      .catch(() => null));
  }

  return mediaCache.get(key);
}

function mediaUrl(item) {
  return item?.meta?.download_url || item?.download_url || item?.file || item?.url || "";
}

function mediaTitle(item, fallback) {
  return item?.title || item?.meta?.slug || fallback;
}

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
    const pos = this.getPos();
    const blockInfo = this.getTopLevelBlockInfoAtPos(this.view.state.doc, pos);

    if (!blockInfo) {
      return;
    }

    const targetIndex = blockInfo.index + direction;

    if (targetIndex < 0 || targetIndex >= this.view.state.doc.childCount) {
      return;
    }

    const targetNode = this.view.state.doc.child(targetIndex);
    let targetStart = 0;

    for (let index = 0; index < targetIndex; index += 1) {
      targetStart += this.view.state.doc.child(index).nodeSize;
    }

    const targetInfo = {
      index: targetIndex,
      node: targetNode,
      start: targetStart,
      end: targetStart + targetNode.nodeSize,
    };

    const movingNode = blockInfo.node;
    const tr = this.view.state.tr;

    if (direction < 0) {
      tr.delete(blockInfo.start, blockInfo.end);
      tr.insert(targetInfo.start, movingNode);
    } else {
      tr.delete(blockInfo.start, blockInfo.end);
      tr.insert(targetInfo.end - movingNode.nodeSize, movingNode);
    }
    this.view.dispatch(tr);
    this.view.focus();
  }

  refreshUI(node) {
    const blockId = node.attrs.id || "";
    this.title.textContent = node.attrs.blockType || "block";
    this.id.textContent = blockId;
    this.id.title = blockId ? `id ${blockId}` : "";

    const pos = this.getPos();
    const info = this.getTopLevelBlockInfoAtPos(this.view.state.doc, pos);

    if (info) {
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
    return (mutation.target === this.header || this.header.contains(mutation.target));
  }
}

class EditableFieldView {
  constructor(node) {
    this.node = node;
    const isManuscriptOwned = node.attrs.mode === "richtext";

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

    for (let itemIndex = 0; itemIndex < index; itemIndex += 1) {
      start += parent.child(itemIndex).nodeSize;
    }

    const node = parent.child(index);
    return { parent, index, node, start, end: start + node.nodeSize };
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

    let targetStart = this.view.state.doc.resolve(this.getPos()).start();
    for (let index = 0; index < targetIndex; index += 1) {
      targetStart += info.parent.child(index).nodeSize;
    }

    const targetNode = info.parent.child(targetIndex);
    const targetEnd = targetStart + targetNode.nodeSize;
    const tr = this.view.state.tr.delete(info.start, info.end);
    tr.insert(direction < 0 ? targetStart : targetEnd - info.node.nodeSize, info.node);
    this.view.dispatch(tr);
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

    if (["image", "document"].includes(node.attrs.controlType)) {
      this.preview = document.createElement("div");
      this.preview.className = "pm-media-preview";
      this.inputWrap.appendChild(this.preview);
      this.refreshPreview();
    }

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
      this.refreshPreview();
    }
    return true;
  }

  async refreshPreview() {
    if (!this.preview) return;

    const { controlType, value } = this.node.attrs;
    this.preview.textContent = value ? "Loading..." : "";
    if (!value) return;

    const item = await fetchMedia(controlType, value);
    this.preview.textContent = "";
    if (!item) {
      this.preview.textContent = `${controlType} ${value} not found`;
      return;
    }

    const url = mediaUrl(item);
    if (controlType === "image" && url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = mediaTitle(item, `Image ${value}`);
      this.preview.appendChild(img);
      return;
    }

    const link = document.createElement(url ? "a" : "span");
    link.textContent = mediaTitle(item, `${controlType} ${value}`);
    if (url) {
      link.href = url;
      link.target = "_blank";
      link.rel = "noreferrer";
    }
    this.preview.appendChild(link);
  }

  stopEvent(event) {
    return ["INPUT", "SELECT", "OPTION", "LABEL", "BUTTON", "A"].includes(event.target?.nodeName);
  }

  ignoreMutation() {
    return true;
  }
}

// Initialization
const editorInstances = [];
const manuscriptRichTextEditors = [];

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
  setupMetadataResize();
  setupMetadataTabs();

  const form = document.querySelector("[data-manuscript-form]");

  form.addEventListener("submit", () => {
    for (const instance of editorInstances) {
      instance.writeBackToTextarea();
    }
  });

  window.manuscriptEditors = editorInstances;
  window.manuscriptRichTextEditors = manuscriptRichTextEditors;
  window.manuscriptBlockRegistry = blockRegistry;
});


function setupMetadataTabs() {
  const tabs = Array.from(document.querySelectorAll("[data-metadata-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-metadata-panel]"));

  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const selected = tab.dataset.metadataTab;
      for (const item of tabs) {
        item.setAttribute("aria-selected", String(item === tab));
      }
      for (const panel of panels) {
        panel.hidden = panel.dataset.metadataPanel !== selected;
      }
    });
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

  const view = new EditorView(mount, {
    state: EditorState.create({
      doc: streamSchema.nodeFromJSON(doc),
      plugins: exampleSetup({
        schema: streamSchema,
      }),
    }),

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

    getJSON() {
      return view.state.doc.toJSON();
    },

    getStreamValue() {
      const pmDoc = applyManuscriptRichTextOverrides(fieldName, view.state.doc.toJSON());
      return pmDoc.content
        .filter((node) => node.type === "stream_block")
        .map(pmStreamBlockToWagtailBlock);
    },

    writeBackToTextarea() {
      textarea.value = JSON.stringify(this.getStreamValue(), null, 2);
    },
  };

  editorInstances.push(instance);
  return instance;
}

function createManuscriptRichTextEditors(manuscriptRoot) {
  if (!manuscriptRoot) return;

  const toolbar = manuscriptRoot.querySelector(".pm-manuscript-toolbar");

  for (const instance of editorInstances) {
    const articleBlocks = Array.from(manuscriptRoot.querySelectorAll("[data-article-block]"))
      .filter((element) => element.dataset.streamField === instance.fieldName);

    (instance.view.state.doc.toJSON().content || []).forEach((block, blockIndex) => {
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

      const view = new EditorView({ mount: articleBlock }, {
        state: EditorState.create({
          doc: richTextSchema.nodeFromJSON({
            type: "doc",
            content: field.content?.length ? field.content : [{ type: "paragraph" }],
          }),
          plugins: exampleSetup({ schema: richTextSchema, floatingMenu: false }),
        }),

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

function applyManuscriptRichTextOverrides(fieldName, pmDoc) {
  const nextDoc = clone(pmDoc);
  const blocks = nextDoc.content || [];

  for (const editor of manuscriptRichTextEditors.filter((item) => item.fieldName === fieldName)) {
    const block = (
      editor.blockId && blocks.find((node) => node.attrs?.id === editor.blockId)
    ) || blocks[editor.blockIndex];
    const field = (block?.content || []).find((child) => child.type === "editable_field" && child.attrs?.mode === "richtext");

    if (field) {
      field.content = editor.view.state.doc.toJSON().content || [{ type: "paragraph" }];
    }
  }

  return nextDoc;
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
    content: (block?.fields || []).map(fieldToPmNode),
  };
}

function fieldToPmNode(field) {
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