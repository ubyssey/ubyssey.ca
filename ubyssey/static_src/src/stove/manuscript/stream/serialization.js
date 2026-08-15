// Converts between editor data, ProseMirror docs, and Wagtail StreamField JSON

import { DOMParser, DOMSerializer, Fragment } from "prosemirror-model";
import { v4 as uuidv4 } from "uuid";

import { richTextSchema } from "../rich_text/index.jsx";
import { streamSchema } from "./schema.js";

// Destroys but Preserves Children
const RICH_TEXT_WRAPPER_SELECTORS = [
  ".pm-stream-block",
  ".pm-stream-block__content",
  ".pm-struct-field",
  ".pm-struct-field__content",
  ".pm-editable-field",
  ".pm-editable-field__content",
];

// Destroyed with Children (editor only stuff not useful for wagtail)
const RICH_TEXT_CHROME_SELECTORS = [
  ".pm-stream-block__header",
  ".pm-stream-block__label",
  ".pm-stream-block__title",
  ".pm-stream-block__id",
  ".pm-stream-block__meta",
  ".pm-article-block-outline",
  ".pm-editor-toolbar",
  ".pm-editable-field__label",
  ".pm-struct-field__label",
];

export function createEmptyRichTextBlock() {
  return streamBlockToPmNode({
    type: "richtext",
    id: uuidv4(),
    value: "",
    field: {
      kind: "editable",
      path: [],
      label: "Rich text",
      mode: "richtext",
      value: "",
    },
  });
}

export function createStreamBlockNodeFromRegistry(blockTypes, blockType) {
  const blockDefinition = blockTypes[blockType];
  return streamSchema.nodeFromJSON(streamBlockToPmNode({
    type: blockType,
    id: uuidv4(),
    value: clone(blockDefinition.defaultValue),
    field: clone(blockDefinition.defaultField),
  }));
}

export function pmDocToStreamValue(pmDoc) {
  return (pmDoc.content || []).filter((node) => node.type === "stream_block").map(pmStreamBlockToWagtailBlock);
}

export function streamBlockToPmNode(block) {
  const blockType = block.type || "unknown";

  return {
    type: "stream_block",
    attrs: {
      id: block.id || uuidv4(),
      blockType,
      originalValue: clone(block.value),
      blockComments: clone(block.blockComments || block.comments || []),
    },
    content: block.field ? [fieldToPmNode(block.field, blockType)] : [],
  };
}

function fieldToPmNode(field, blockType = null) {
  if (field.kind === "struct") {
    return {
      type: "struct_field",
      attrs: {
        path: field.path,
        label: field.label,
        originalValue: clone(field.value),
      },
      content: (field.fields || []).map((child) => fieldToPmNode(child)),
    };
  }

  if (field.kind === "list") {
    return {
      type: "list_field",
      attrs: {
        path: field.path,
        label: field.label,
        itemValue: field.itemValue,
        itemField: field.itemField,
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
    content = text.trim() ? text.split(/\n{2,}/).map((paragraphText) => ({
        type: "paragraph",
        content: paragraphText ? [{ type: "text", text: paragraphText }] : undefined,
    })) : [{ type: "paragraph" }];
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

export function listItemToPmNode(field, item = null) {
  const value = item ? item.value : clone(field.itemValue);
  const itemField = item ? item.field : clone(field.itemField);
  const itemFields = item ? item.fields : clone(field.itemFields);

  return {
    type: "list_item",
    attrs: { originalValue: clone(value) },
    content: itemField ? [fieldToPmNode(itemField)] : (itemFields || []).map((child) => fieldToPmNode(child)),
  };
}

export function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function pmStreamBlockToWagtailBlock(node) {
  const attrs = node.attrs || {};
  const block = {
    type: attrs.blockType || "unknown",
    value: clone(attrs.originalValue),
  };

  if (attrs.id) block.id = attrs.id;

  const blockComments = (Array.isArray(attrs.blockComments) ? attrs.blockComments : [])
    .filter((thread) => !thread.pending && Array.isArray(thread.comments) && thread.comments.length);
  if (blockComments.length) block.comments = clone(blockComments);

  for (const field of node.content || []) {
    const path = field.attrs?.path || [];
    const value = fieldValue(field, getValueAtPath(block.value, path));
    block.value = path.length ? setFieldValue(block.value, path, value) : value;
  }

  return block;
}

function fieldValue(node, originalValue) {
  const attrs = node.attrs || {};

  if (node.type === "editable_field") {
    return editableFieldValue(node, attrs.mode);
  }
  if (node.type === "control_field") {
    return controlFieldValue(attrs, originalValue);
  }
  if (node.type === "struct_field") {
    return structFieldValue(node);
  }
  if (node.type === "list_field") {
    return listFieldValue(node);
  }

  return originalValue;
}

function structFieldValue(node) {
  let value = clone(node.attrs?.originalValue);

  for (const child of node.content || []) {
    const path = child.attrs?.path || [];
    const originalValue = getValueAtPath(value, path);
    value = setFieldValue(value, path, fieldValue(child, originalValue));
  }

  return value;
}

function listFieldValue(node) {
  return (node.content || [])
    .filter((item) => item.type === "list_item")
    .map((item) => {
      let value = clone(item.attrs?.originalValue);
      for (const field of item.content) {
        const path = field.attrs.path;
        const fieldContent = fieldValue(field, getValueAtPath(value, path));
        value = path.length ? setFieldValue(value, path, fieldContent) : fieldContent;
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
    .map((block) => richTextSchema.nodeFromJSON(block));

  // Checks if content is empty and doesn't serialize
  const hasContent = richTextNodes.some((richTextNode) => (
    richTextNode.textContent.trim() !== ""
  ));
  if(!hasContent) return "";

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
  
  if (controlType === "boolean") value = Boolean(value);
  if (["image", "document"].includes(controlType) && value === "") value = null;
  if (controlType === "number") {
    value = value === "" || value == null ? null : Number(value);
  }

  return Array.isArray(originalValue) ? [value] : value;
}

function setFieldValue(root, path, value) {
  if (path.length === 0) return value;

  let current = root;
  for (const key of path.slice(0, -1)) {
    current = current[key];
  }
  current[path[path.length - 1]] = value;
  return root;
}

function getValueAtPath(root, path) {
  let current = root;
  for (const key of path) current = current[key];
  return current;
}
