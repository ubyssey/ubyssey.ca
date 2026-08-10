// Converts between editor data, ProseMirror docs, and Wagtail StreamField JSON

import { DOMParser, DOMSerializer, Fragment } from "prosemirror-model";
import { v4 as uuidv4 } from "uuid";

import { richTextSchema } from "../rich_text/index.jsx";
import { streamSchema } from "./schema.js";

// Destroys but Preserves Children
const RICH_TEXT_WRAPPER_SELECTORS = [
  ".pm-stream-block",
  ".pm-stream-block__content",
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
];

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

export function createStreamBlockNodeFromRegistry(blockTypes, blockType) {
  const blockDefinition = blockTypes?.[blockType] || {};
  const defaultValue = blockDefinition.defaultValue !== undefined ? blockDefinition.defaultValue : "";
  return streamSchema.nodeFromJSON(streamBlockToPmNode({
    type: blockType,
    id: uuidv4(),
    value: clone(defaultValue),
    fields: clone(blockDefinition.defaultFields || []),
  }));
}

export function pmDocToStreamValue(pmDoc) {
  return (pmDoc.content || []).filter((node) => node.type === "stream_block").map(pmStreamBlockToWagtailBlock);
}

export function streamBlockToPmNode(block) {
  const blockType = block?.type || "unknown";

  return {
    type: "stream_block",
    attrs: {
      id: block?.id || uuidv4(),
      blockType,
      originalValue: clone(block?.value),
      blockComments: clone(block?.blockComments || block?.comments || []),
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
  return {
    type: "list_item",
    attrs: { originalValue: clone(value) },
    content: ((item && item.fields) || field.itemFields || []).map(fieldToPmNode),
  };
}

export function clone(value) {
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

  const blockComments = (Array.isArray(attrs.blockComments) ? attrs.blockComments : [])
    .filter((thread) => !thread.pending && Array.isArray(thread.comments) && thread.comments.length);
  if (blockComments.length) {
    block.comments = clone(blockComments);
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

  // Checks if content is empty and doesn't serialize
  const hasContent = richTextNodes.some((richTextNode) => (
    richTextNode.textContent.trim() != ""
  ))
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
