// Prevents fields from diverging from their schema definitions

import { Fragment } from "prosemirror-model";
import { prosemirrorToYXmlFragment, yXmlFragmentToProseMirrorRootNode } from "y-prosemirror";
import { samePath } from "./fields.js";
import { streamSchema } from "./stream_schema.js";

const fieldNodeTypes = {
  struct: "struct_field",
  list: "list_field",
  stream: "stream_field",
  control: "control_field",
  editable: "editable_field",
};

// Repairs are one YJS transaction
export function normalizeSharedStreamDocuments(ydoc, streamEditors) {
  const repairs = Object.entries(streamEditors).flatMap(([fieldName, streamEditor]) => {
    const fragment = ydoc.getXmlFragment(fieldName);
    const doc = yXmlFragmentToProseMirrorRootNode(fragment, streamSchema);
    const normalized = normalizeStreamDocument(doc, streamEditor.blockTypes);
    return normalized.eq(doc) ? [] : [{ fragment, doc: normalized }];
  });
  if (!repairs.length) return false;

  ydoc.transact(() => repairs.forEach(({ fragment, doc }) => {
    prosemirrorToYXmlFragment(doc, fragment);
  }), "stream-schema-repair");
  return true;
}

function normalizeStreamDocument(doc, blockTypes = {}) {
  let changed = false;
  const blocks = [];

  doc.forEach((block) => {
    const definition = blockTypes[block.attrs?.blockType]?.defaultField;
    const field = block.childCount === 1 ? block.firstChild : null;
    const normalizedField = definition && field ? normalizeField(field, definition, block.attrs?.blockType) : field;
    if (!normalizedField || normalizedField.eq(field)) blocks.push(block);
    else {
      changed = true;
      blocks.push(block.type.create(block.attrs, Fragment.from(normalizedField), block.marks));
    }
  });

  return changed ? doc.type.create(doc.attrs, Fragment.fromArray(blocks), doc.marks) : doc;
}

function normalizeField(node, definition, blockType = null) {
  if (!node || node.type.name !== fieldNodeTypes[definition.kind]) return node;
  const content = definition.kind === "struct"
    ? normalizeChildren(node, definition.fields || [])
    : definition.kind === "list"
      ? normalizeList(node, definition.itemField)
      : definition.kind === "stream"
        ? normalizeStream(node, definition.blockTypes || {})
        : node.content;
  return node.type.create(normalizedAttrs(node, definition, blockType), content, node.marks);
}

function normalizedAttrs(node, definition, blockType) {
  const pathAndLabel = { path: definition.path || [], label: definition.label };
  if (definition.kind === "editable") return { ...pathAndLabel, mode: definition.mode, streamRoot: blockType === "richtext" && samePath(definition.path, []) };
  if (definition.kind === "control") return { ...pathAndLabel, controlType: definition.controlType, value: node.attrs?.value, options: definition.options || null };
  if (definition.kind === "struct") return { ...pathAndLabel, originalValue: node.attrs?.originalValue };
  if (definition.kind === "list") return { ...pathAndLabel, itemValue: definition.itemValue, itemField: definition.itemField || null, itemFields: definition.itemFields || [] };
  return { ...pathAndLabel, blockTypes: definition.blockTypes || {} };
}

function normalizeChildren(node, definitions) {
  const children = Array.from({ length: node.childCount }, (_item, index) => node.child(index));
  const used = new Set();
  const normalized = definitions.flatMap((definition) => {
    const index = matchingChildIndex(children, used, definition);
    if (index < 0) return [];
    used.add(index);
    return [normalizeField(children[index], definition)];
  });

  // preserve unknown fields
  children.forEach((child, index) => { if (!used.has(index)) normalized.push(child); });
  return Fragment.fromArray(normalized);
}

function matchingChildIndex(children, used, definition) {
  const type = fieldNodeTypes[definition.kind];
  const byPath = children.findIndex((child, index) => !used.has(index) && child.type.name === type && samePath(child.attrs?.path, definition.path));
  if (byPath >= 0) return byPath;
  return children.findIndex((child, index) => !used.has(index) && child.type.name === type);
}

function normalizeList(node, itemDefinition) {
  if (!itemDefinition) return node.content;
  const items = [];
  node.forEach((item) => {
    const content = item.type.name === "list_item" ? normalizeChildren(item, [itemDefinition]) : item.content;
    items.push(item.type.name === "list_item" ? item.type.create({ originalValue: item.attrs?.originalValue }, content, item.marks) : item);
  });
  return Fragment.fromArray(items);
}

function normalizeStream(node, blockTypes) {
  const items = [];
  node.forEach((item) => {
    const definition = blockTypes[item.attrs?.blockType]?.defaultField;
    if (item.type.name !== "stream_item" || !definition) return items.push(item);
    items.push(item.type.create({ ...item.attrs }, normalizeChildren(item, [definition]), item.marks));
  });
  return Fragment.fromArray(items);
}
