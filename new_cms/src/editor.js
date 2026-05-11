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
// Aparently how Wagtail generates block IDs? Not 100% sure.
import { v4 as uuidv4 } from "uuid";

// Image/Document API
const mediaCache = {
  images: new Map(),
  documents: new Map(),
};

async function fetchWagtailMedia(kind, id) {
  if (!id) return null;

  const cache = mediaCache[kind];
  const cacheKey = String(id);

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const promise = fetch(
    `/new-cms/api/v2/${kind}/${encodeURIComponent(id)}/`, { credentials: "same-origin", })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`${endpoint} ${id} returned ${response.status}`);
      }
      return response.json();
    })
    .catch((error) => {
      console.warn(`Could not fetch Wagtail ${endpoint} ${id}.`, error);
      return null;
    });

  cache.set(cacheKey, promise);
  return promise;
}

function getMediaUrl(item) {
  return (
    item?.meta?.download_url ||
    item?.download_url ||
    item?.file ||
    item?.url ||
    "");
}

function getMediaTitle(item, fallback = "") {
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
    content: "(editable_field | control_field)*",
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
});

// Nothing for now
const marks = basicSchema.spec.marks.append({})

const richTextSchema = new Schema({
  nodes: baseNodesWithLists,
  marks,
});

const streamSchema = new Schema({
  nodes,
  marks,
});

// Nodeviews -> https://prosemirror.net/docs/ref/#view.NodeView
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

    this.meta = document.createElement("div");
    this.meta.className = "pm-stream-block__meta";

    titleWrap.appendChild(this.title);
    titleWrap.appendChild(this.meta);

    this.controls = this.createControls();

    this.header.appendChild(titleWrap);
    this.header.appendChild(this.controls);

    this.contentDOM = document.createElement("div");
    this.contentDOM.className = "pm-stream-block__content";

    this.emptyMessage = document.createElement("div");
    this.emptyMessage.className = "pm-stream-block__empty";
    this.emptyMessage.textContent = "Unimplemented Block";

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

    this.insertButton = this.createButton("Insert block", () => {
      this.insertBlock(this.insertSelect.value);
    });

    this.moveUpButton = this.createButton("↑", () => { this.moveBlock(-1); }, "Move block up");
    this.moveDownButton = this.createButton("↓", () => { this.moveBlock(1); }, "Move block down");
    this.deleteButton = this.createButton("Delete", () => { this.deleteBlock(); }, "Delete block");
    this.deleteButton.classList.add("pm-stream-block__button--danger");

    controls.appendChild(this.insertSelect);
    controls.appendChild(this.insertButton);
    controls.appendChild(this.moveUpButton);
    controls.appendChild(this.moveDownButton);
    controls.appendChild(this.deleteButton);

    return controls;
  }

  createButton(text, onClick, title = text) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pm-stream-block__button";
    button.textContent = text;
    button.title = title;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      onClick();
    });
    return button;
  }

  insertBlock(blockType) {
    const pos = this.getPos();

    const pmNode = streamSchema.nodeFromJSON(
      streamBlockToPmNode(
        {
          type: blockType,
          value: (() => {
            const blockDefinition = this.blockRegistry?.byStreamField?.[this.streamFieldName]?.[blockType];

            if (blockDefinition?.defaultValue !== undefined) {
              return JSON.parse(JSON.stringify(blockDefinition.defaultValue));
            }

            if (blockType === "richtext") {
              return "";
            }

            const fieldEntries = Object.entries(blockDefinition?.fields);

            if (!fieldEntries.length) {
              return "";
            }

            const value = {};

            for (const [fieldName, fieldMeta] of fieldEntries) {
              if (fieldMeta?.kind === "boolean") {
                value[fieldName] = false;
              } else if (fieldMeta?.kind === "image" || fieldMeta?.kind === "document") {
                value[fieldName] = null;
              } else if (fieldMeta?.kind === "choice") {
                const options = Array.isArray(fieldMeta.options) ? fieldMeta.options : [];
                const firstRealOption = options.find(
                  (option) => String(option.value || "") !== "",
                );
                value[fieldName] = firstRealOption?.value ?? options[0]?.value ?? "";
              } else {
                value[fieldName] = "";
              }
            }

            return value;
          })(),
          id: uuidv4(),
        },
        this.blockRegistry,
        this.streamFieldName,
      ),
    );

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
    const editableCount = node.childCount;
    this.title.textContent = node.attrs.blockType || "block";
    this.meta.textContent = editableCount ? `${editableCount} editable field${editableCount === 1 ? "" : "s"}` : "not editable";

    if (!editableCount && !this.emptyMessage.parentNode) {
      this.contentDOM.appendChild(this.emptyMessage);
    } else if (editableCount && this.emptyMessage.parentNode) {
      this.emptyMessage.remove();
    }

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

    this.dom = document.createElement("div");
    this.dom.className = "pm-editable-field";

    const label = document.createElement("div");
    label.className = "pm-editable-field__label";
    label.textContent = node.attrs.label || "Content";

    this.contentDOM = document.createElement("div");
    this.contentDOM.className = "pm-editable-field__content";

    this.dom.appendChild(label);
    this.dom.appendChild(this.contentDOM);
  }
}

class ControlFieldView {
  constructor(node, view, getPos) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.previewRequestId = 0;

    this.dom = document.createElement("div");
    this.dom.className = `pm-control-field pm-control-field--${node.attrs.controlType || "text"}`;

    this.label = document.createElement("label");
    this.label.className = "pm-control-field__label";
    this.label.textContent = node.attrs.label || "Field";

    this.inputWrap = document.createElement("div");
    this.inputWrap.className = "pm-control-field__input";

    this.input = this.createInput(node);
    this.preview = this.createPreview(node);

    this.inputWrap.appendChild(this.input);

    if (this.preview) {
      this.inputWrap.appendChild(this.preview);
      this.refreshPreview();
    }

    this.dom.appendChild(this.label);
    this.dom.appendChild(this.inputWrap);
  }

  createInput(node) {
    const controlType = node.attrs.controlType;
    const value = node.attrs.value || "";

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
      const options = node.attrs.options;

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

    if (controlType === "image" || controlType === "document") {
      const wrapper = document.createElement("div");
      wrapper.className = "pm-media-control";

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

      wrapper.appendChild(input);

      return wrapper;
    }

    const input = document.createElement("input");
    input.type = "text";
    input.value = value;

    input.addEventListener("input", () => {
      this.updateValue(input.value);
    });

    return input;
  }

  createPreview(node) {
    if (!["image", "document"].includes(node.attrs.controlType)) {
      return null;
    }

    const preview = document.createElement("div");
    preview.className = "pm-media-preview";
    preview.textContent = "No media selected";

    return preview;
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
    } else if (node.attrs.controlType === "image" || node.attrs.controlType === "document") {
      const input = this.input.querySelector("input");
      if (input) {
        input.value = node.attrs.value || "";
      }
      this.refreshPreview();
    } else {
      this.input.value = node.attrs.value || "";
    }
    return true;
  }

  async refreshPreview() {
    if (!this.preview) {
      return;
    }

    const controlType = this.node.attrs.controlType;
    const value = this.node.attrs.value;

    this.preview.innerHTML = "";

    if (!value) {
      this.preview.textContent = "No media selected";
      return;
    }

    this.preview.textContent = "Loading…";
    const item = controlType === "image" ? await fetchWagtailMedia("images", value) : await fetchWagtailMedia("documents", value);
    this.preview.innerHTML = "";

    if (!item) {
      this.preview.textContent = `${controlType} ${value} could not be loaded`;
      return;
    }

    if (controlType === "image") {
      this.renderImagePreview(item);
    } else {
      this.renderDocumentPreview(item);
    }
  }

  renderImagePreview(image) {
    const previewUrl = getMediaUrl(image);
    const title = getMediaTitle(image, `Image ${this.node.attrs.value}`);

    const card = document.createElement("div");
    card.className = "pm-media-card pm-media-card--image";

    if (previewUrl) {
      const img = document.createElement("img");
      img.className = "pm-media-card__image";
      img.src = previewUrl;
      img.alt = title;
      card.appendChild(img);
    }

    const body = document.createElement("div");
    body.className = "pm-media-card__body";

    const heading = document.createElement("div");
    heading.className = "pm-media-card__title";
    heading.textContent = title;

    const meta = document.createElement("div");
    meta.className = "pm-media-card__meta";
    meta.textContent = `Image ID: ${this.node.attrs.value}`;

    body.appendChild(heading);
    body.appendChild(meta);
    card.appendChild(body);

    this.preview.appendChild(card);
  }

  renderDocumentPreview(documentItem) {
    const url = getMediaUrl(documentItem);
    const title = getMediaTitle(documentItem, `Document ${this.node.attrs.value}`);

    const card = document.createElement("div");
    card.className = "pm-media-card pm-media-card--document";

    const body = document.createElement("div");
    body.className = "pm-media-card__body";

    const heading = document.createElement(url ? "a" : "div");
    heading.className = "pm-media-card__title";
    heading.textContent = title;

    if (url) {
      heading.href = url;
      heading.target = "_blank";
      heading.rel = "noreferrer";
    }

    const meta = document.createElement("div");
    meta.className = "pm-media-card__meta";
    meta.textContent = `Document ID: ${this.node.attrs.value}`;

    body.appendChild(heading);
    body.appendChild(meta);
    card.appendChild(body);

    this.preview.appendChild(card);
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

document.addEventListener("DOMContentLoaded", () => {
  const packedBlocks = JSON.parse(document.getElementById("packed-blocks").textContent);
  const registry = { byStreamField: {}, };

  for (const [streamFieldName, packedValue] of Object.entries( packedBlocks || {} )) {
    registry.byStreamField[streamFieldName] = extractBlockDefinitions(packedValue);
  }

  const textareas = Array.from(document.querySelectorAll("[data-stream-json]"));
  for (const textarea of textareas) {
    createStreamEditor(textarea, registry);
  }

  const form = document.querySelector("[data-manuscript-form]");

  form.addEventListener("submit", () => {
    for (const instance of editorInstances) {
      instance.writeBackToTextarea();
    }
  });

  window.manuscriptEditors = editorInstances;
  window.manuscriptBlockRegistry = registry;
});

function createStreamEditor(textarea, blockRegistry) {
  const fieldName = textarea.dataset.streamField;
  const mount = document.querySelector(`[data-stream-editor="${window.CSS.escape(fieldName)}"]`);

  let streamValue = JSON.parse(textarea.value || "[]");

  const content = streamValue.map((block) => {
    return streamBlockToPmNode(block, blockRegistry, fieldName);
  });

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
          availableBlockTypes: (() => {
            const streamRegistry = blockRegistry?.byStreamField?.[fieldName] || {};
            const types = new Set(Object.keys(streamRegistry));

            for (const block of streamValue) {
              types.add(block.type);
            }

            return Array.from(types).sort((a, b) => a.localeCompare(b));
          })(),
        });
      },

      editable_field(node) {
        return new EditableFieldView(node);
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
      const pmDoc = view.state.doc.toJSON();
      return pmDoc.content
        .filter((node) => node.type === "stream_block")
        .map(pmStreamBlockToWagtailBlock);
    },

    writeBackToTextarea() {
      textarea.value = JSON.stringify(this.getStreamValue(), null, 2);
    },
  };

  editorInstances.push(instance);
}

// Parse Wagtail/Telepath
function extractBlockDefinitions(packedValue) {
  const definitions = {};

  walkPackedValue(packedValue, {
    onBlockDefinition(blockName, definition) {
      if (!blockName) return;

      if (!definitions[blockName]) {
        definitions[blockName] = { fields: {}, defaultValue: definition.defaultValue};
      }

      Object.assign(definitions[blockName].fields, definition.fields || {});

      if (definitions[blockName].defaultValue === undefined && definition.defaultValue !== undefined) {
        definitions[blockName].defaultValue = definition.defaultValue;
      }
    },
  });

  return definitions;
}

function walkPackedValue(value, handlers, context = {}) {
  if (Array.isArray(value)) {
    for (const item of value) {
      walkPackedValue(item, handlers, context);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const wagtailType = value._type || "";

  if (value._args && typeof value._args[0] === "string" && String(wagtailType || "").startsWith("wagtail.blocks.")) {
    const ownName = value._args[0];

    if (!String(wagtailType || "").includes("FieldBlock")) {
      const fields = {};
      const args = Array.isArray(value?._args) ? value._args : [];
      const children = Array.isArray(args[1]) ? args[1] : [];

      for (const child of children) {
        if (!child || typeof child !== "object") continue;

        if (String(child._type || "").includes("FieldBlock")) {
          const fieldInfo = extractFieldBlockInfo(child._args);

          if (fieldInfo) {
            fields[fieldInfo.name] = fieldInfo;
          }
        }
      }

      // FieldBlock: ["name", widget, meta]
      // StructBlock: ["name", children, meta] or ["name", children, default, meta]
      // ListBlock: ["name", childDef, default, meta]
      // StreamBlock: ["name", childDefs, default, meta]
      const defaultValue = value._args.length >= 4 ? value._args[2] : undefined;
      handlers.onBlockDefinition(ownName, { fields, defaultValue });
    }
  }

  if (String(wagtailType || "").includes("FieldBlock")) {
    const fieldInfo = extractFieldBlockInfo(value._args);

    if (context.blockName && fieldInfo) {
      handlers.onBlockDefinition(context.blockName, {
        fields: {
          [fieldInfo.name]: fieldInfo,
        },
      });
    }
  }

  if (value._args && typeof value._args[0] === "string" && String(wagtailType || "").startsWith("wagtail.blocks.")) {
    const ownName = value._args[0];

    for (const child of value._args.slice(1)) {
      walkPackedValue(child, handlers, {...context, blockName: ownName});
    }
  }

  for (const child of Object.values(value)) {
    if (child === value._args) {
      continue;
    }
    walkPackedValue(child, handlers, context);
  }
}

function extractFieldBlockInfo(args) {
  if (!Array.isArray(args) || args.length < 2) {
    return null;
  }

  const [fieldName, widgetDef, meta] = args;

  if (typeof fieldName !== "string") {
    return null;
  }

  const widgetType = widgetDef._type || "";
  const widgetArgs = widgetDef?._args;
  const widgetHtml =widgetArgs[0];
  const label = meta?.label || meta?._dict?.label || fieldName;

  if (String(widgetType).includes("DraftailRichTextArea")) {
    return {
      name: fieldName,
      label,
      kind: "richtext",
    };
  }

  if (String(widgetType).includes("ImageChooser")) {
    return {
      name: fieldName,
      label,
      kind: "image",
    };
  }

  if (String(widgetType).includes("DocumentChooser")) {
    return {
      name: fieldName,
      label,
      kind: "document",
    };
  }

  if (widgetHtml.includes("<select")) {
    return {
      name: fieldName,
      label,
      kind: "choice",
      options: (() => {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = widgetHtml;

        return Array.from(wrapper.querySelectorAll("option")).map((option) => ({
          value: option.getAttribute("value") || "",
          label: option.textContent.trim() || option.getAttribute("value") || "",
        }));
      })(),
    };
  }

  if (widgetHtml.includes('type="checkbox"')) {
    return {
      name: fieldName,
      label,
      kind: "boolean",
    };
  }

  if (widgetHtml.includes('type="text"') || widgetHtml.includes('type="url"') || widgetHtml.includes("<textarea")) {
    return {
      name: fieldName,
      label,
      kind: "plain_text",
    };
  }

  return {
    name: fieldName,
    label,
    kind: "unknown",
  };
}

// Wagtail -> Prosemirror
function createEmptyRichTextBlock() {
  return {
    type: "stream_block",
    attrs: {
      id: uuidv4(),
      blockType: "richtext",
      originalValue: "",
    },
    content: [
      {
        type: "editable_field",
        attrs: {
          path: [],
          label: "Rich text",
          mode: "richtext",
        },
        content: [
          {
            type: "paragraph",
          },
        ],
      },
    ],
  };
}

function streamBlockToPmNode(block, blockRegistry, streamFieldName) {
  const blockType = block?.type || "unknown";
  const blockId = block?.id || uuidv4();
  const originalValue = JSON.parse(JSON.stringify(block?.value));
  const fields = extractEditableFields(originalValue, { blockType, blockRegistry, streamFieldName });

  return {
    type: "stream_block",
    attrs: {
      id: blockId,
      blockType,
      originalValue,
    },
    content: fields.map((field) => {
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

      const content = field.mode === "plain_text" ? (() => {
        const value = String(field.value || "");

        if (!value.trim()) {
          return [{ type: "paragraph" }];
        }

        return value.split(/\n{2,}/).map((paragraphText) => ({
          type: "paragraph",
          content: paragraphText ? [{ type: "text", text: paragraphText }] : undefined,
        }));

      })() : (() => {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = field.value || "";
        const chromeSelectors = [
          ".pm-stream-block__header",
          ".pm-stream-block__label",
          ".pm-stream-block__title",
          ".pm-stream-block__meta",
          ".pm-editable-field__label",
        ];

        wrapper.querySelectorAll(chromeSelectors.join(",")).forEach((element) => {
          element.remove();
        });

        wrapper.querySelectorAll(".pm-stream-block, .pm-stream-block__content, .pm-editable-field, .pm-editable-field__content",
        ).forEach((element) => {
          element.replaceWith(...Array.from(element.childNodes));
        });
        
        const parsedDoc = DOMParser.fromSchema(richTextSchema).parse(wrapper);
        const json = parsedDoc.toJSON();
        return Array.isArray(json.content) && json.content.length ? json.content : [{ type: "paragraph" }];
      })();

      return {
        type: "editable_field",
        attrs: {
          path: field.path,
          label: field.label,
          mode: field.mode,
        },
        content,
      };
    }),
  };
}

function extractEditableFields(value, options = {}) {
  const fields = [];
  const blockType = options.blockType || "block";
  const streamRegistry = options.blockRegistry?.byStreamField?.[options.streamFieldName];
  const blockDefinition = streamRegistry?.[blockType];
  const topLevelMeta = blockDefinition?.fields?.[blockType] || null;

  if (typeof value === "string") {
    if (topLevelMeta?.kind === "richtext" || blockType === "richtext") {
      fields.push({
        kind: "editable",
        path: [],
        label: topLevelMeta?.label || blockType || "Content",
        mode: "richtext",
        value,
      });
    } else if (topLevelMeta?.kind === "plain_text") {
      fields.push({
        kind: "editable",
        path: [],
        label: topLevelMeta?.label || blockType || "Content",
        mode: "plain_text",
        value,
      });
    }

    return fields;
  }

  walkValue(value, [], fields, blockType, options);

  return fields;
}

function walkValue(value, path, fields, blockType, options = {}) {
  let fieldName = null;

  for (let index = path.length - 1; index >= 0; index -= 1) {
    if (typeof path[index] === "string") {
      fieldName = path[index];
      break;
    }
  }

  const streamRegistry = options.blockRegistry?.byStreamField?.[options.streamFieldName];
  const blockDefinition = streamRegistry?.[blockType];
  const fieldMeta = fieldName ? blockDefinition?.fields?.[fieldName] || null : null;

  if (fieldMeta?.kind === "image" || fieldMeta?.kind === "document") {
    if (
      value === null ||
      value === undefined ||
      typeof value === "number" ||
      typeof value === "string"
    ) {
      fields.push({
        kind: "control",
        path,
        label: fieldMeta.label || path.filter((part) => typeof part === "string").join(" / ") || blockType || "Content",
        controlType: fieldMeta.kind,
        value,
        options: null,
      });

      return;
    }
  }

  if (typeof value === "string") {
    if (fieldMeta?.kind === "richtext") {
      fields.push({
        kind: "editable",
        path,
        label: fieldMeta?.label || path.filter((part) => typeof part === "string").join(" / ") || blockType || "Content",
        mode: "richtext",
        value,
      });
    } else if (fieldMeta?.kind === "plain_text") {
      fields.push({
        kind: "editable",
        path,
        label: fieldMeta.label || path.filter((part) => typeof part === "string").join(" / ") || blockType || "Content",
        mode: "plain_text",
        value,
      });
    } else if (fieldMeta?.kind === "choice") {
      fields.push({
        kind: "control",
        path,
        label: fieldMeta.label || path.filter((part) => typeof part === "string").join(" / ") || blockType || "Content",
        controlType: "choice",
        value,
        options: fieldMeta.options || [],
      });
    }

    return;
  }

  if (typeof value === "boolean") {
    if (fieldMeta?.kind === "boolean") {
      fields.push({
        kind: "control",
        path,
        label: fieldMeta.label || path.filter((part) => typeof part === "string").join(" / ") || blockType || "Content",
        controlType: "boolean",
        value,
      });
    }

    return;
  }

  if (Array.isArray(value)) {
    if (fieldMeta?.kind === "choice" && value.length <= 1) {
      fields.push({
        kind: "control",
        path,
        label: fieldMeta.label || path.filter((part) => typeof part === "string").join(" / ") || blockType || "Content",
        controlType: "choice",
        value: value[0] ?? "",
        options: fieldMeta.options || [],
      });
      return;
    }

    value.forEach((item, index) => {
      walkValue(item, path.concat(index), fields, blockType, options);
    });

    return;
  }

  if (value && typeof value === "object") {
    for (const [key, childValue] of Object.entries(value)) {
      walkValue(childValue, path.concat(key), fields, blockType, options);
    }
  }
}

// Prosemirror -> Wagtail
function pmStreamBlockToWagtailBlock(node) {
  const attrs = node.attrs || {};

  const block = {
    type: attrs.blockType || "unknown",
    value: JSON.parse(JSON.stringify(attrs.originalValue)),
  };

  if (attrs.id) {
    block.id = attrs.id;
  }

  const childNodes = Array.isArray(node.content) ? node.content : [];

  for (const childNode of childNodes) {
    const fieldAttrs = childNode.attrs || {};
    const path = Array.isArray(fieldAttrs.path) ? fieldAttrs.path : [];

    if (childNode.type === "editable_field") {
      const nextValue = (fieldAttrs.mode || "richtext") === "plain_text" ? (childNode.content || [])
        .map((pmBlock) => streamSchema.nodeFromJSON(pmBlock).textContent)
        .join("\n\n") : (() => { 
          // PM to HTML conversion
          const cleanBlocks = (childNode.content || []).filter((block) => {
            return (
              block.type !== "stream_block" &&
              block.type !== "editable_field" &&
              block.type !== "control_field"
            );
          });

          const richTextNodes = cleanBlocks.map((block) =>
            richTextSchema.nodeFromJSON(block),
          );
          const fragment = Fragment.fromArray(richTextNodes);

          const serializer = DOMSerializer.fromSchema(richTextSchema);
          const domFragment = serializer.serializeFragment(fragment);

          const wrapper = document.createElement("div");
          wrapper.appendChild(domFragment);

          return wrapper.innerHTML;
        })();

      if (path.length === 0) {
        block.value = nextValue;
      } else {
        setValueAtPath(block.value, path, nextValue);
      }
    }

    if (childNode.type === "control_field") {
      let nextValue = fieldAttrs.value;
      const controlType = fieldAttrs.controlType || "text";

      if (controlType === "boolean") {
        nextValue = Boolean(nextValue);
      }

      if ((controlType === "image" || controlType === "document") && nextValue === "") {
        nextValue = null;
      }

      let originalValue = block.value;

      for (const key of path) {
        if (originalValue == null || typeof originalValue !== "object") {
          originalValue = undefined;
          break;
        }

        originalValue = originalValue[key];
      }

      if (Array.isArray(originalValue)) {
        nextValue = [nextValue];
      }

      if (path.length === 0) {
        block.value = nextValue;
      } else {
        setValueAtPath(block.value, path, nextValue);
      }
    }
  }

  return block;
}

// Example
// root = { one { value: two }}
// setValueAtPath(root, ["one", "two"], "three")
// Now root = { one { value: three }}

function setValueAtPath(root, path, value) {
  if (!path.length) {
    return value;
  }
  let current = root;

  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];

    if (current == null || typeof current !== "object") {
      return root;
    }

    current = current[key];
  }

  const finalKey = path[path.length - 1];

  if (current && typeof current === "object") {
    current[finalKey] = value;
  }

  return root;
}
