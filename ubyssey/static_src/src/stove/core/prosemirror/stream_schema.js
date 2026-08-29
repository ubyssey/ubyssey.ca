// The Prosemirror Schema for Wagtail StreamFields

import { Schema } from "prosemirror-model";
// Marks handled within RichText folder
import { baseNodesWithLists, marks } from "../richtext/schema.js";

// Document Schema
const streamNodes = baseNodesWithLists.remove("doc").append({
  doc: {
    content: "stream_block+",
  },

  stream_block: {
    content: "field*",
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

  struct_field: {
    group: "field",
    content: "field*",
    isolating: true,
    defining: true,
    attrs: {
      path: { default: [] },
      label: { default: "Field" },
      originalValue: { default: {} },
    },

    toDOM(node) {
      return [
        "div",
        {
          class: "pm-struct-field",
          "data-field-label": node.attrs.label || "Field",
        },
        [
          "div",
          { class: "pm-struct-field__label", contenteditable: "false" },
          node.attrs.label || "Field",
        ],
        ["div", { class: "pm-struct-field__content" }, 0],
      ];
    },
  },

  editable_field: {
    group: "field",
    content: "block*",
    isolating: true,
    defining: true,
    attrs: {
      path: { default: [] },
      label: { default: "Content" },
      mode: { default: "richtext" },
      streamRoot: { default: false },
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
          { class: "pm-editable-field__label", contenteditable: "false" },
          node.attrs.label || "Content",
        ],
        ["div", { class: "pm-editable-field__body" }, 0],
      ];
    },
  },

  control_field: {
    group: "field",
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
    group: "field",
    content: "list_item*",
    isolating: true,
    defining: true,
    attrs: {
      path: { default: [] },
      label: { default: "List" },
      itemValue: { default: null },
      itemField: { default: null },
      itemFields: { default: [] },
    },

    toDOM(node) {
      return [
        "div",
        { class: "pm-list-field", "data-field-label": node.attrs.label || "List" },
        ["div", { class: "pm-list-field__label", contenteditable: "false" }, node.attrs.label || "List"],
        ["div", { class: "pm-list-field__items" }, 0],
      ];
    },
  },

  list_item: {
    content: "field*",
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

// Each richtext field has it's own prosemirror EditorView, binded to a Y.XmlElement with ySyncPlugin (this allows direct editing from the preview representation)
// Normally the document root is a doc node, but here it is an editable_field
// ie binding to a Y.XmlElement rather than a Prosemirror Doc
export const streamRichTextSchema = new Schema({
  nodes: baseNodesWithLists.remove("doc").append({
    editable_field: streamNodes.get("editable_field"),
  }),
  marks,
  topNode: "editable_field",
});
