import { topLevelBlockInfoByIdOrIndex } from "./blocks.js";

// Preview elements have paths like image.alt_text or gallery.0.caption within their html template 
// (this should definitely be changed if someone can think of a better way)
// Alternatively maybe we should shorten the data-* names

// Finds a field within a block and returns position within document
export function editableFieldInfo(block, path) {
  const match = editableFieldInfoInNode(block.node, path);
  return match && {
    ...match,
    pos: block.start + 1 + match.pos,
  };
}

function editableFieldInfoInNode(parent, targetPath, pathPrefix = [], startPos = 0) {
  let offset = 0;

  for (let index = 0; index < parent.childCount; index += 1) {
    const node = parent.child(index);
    const pos = startPos + offset;

    if (node.type.name === "editable_field") {
      const path = pathPrefix.concat(node.attrs?.path || []);
      if (samePath(path, targetPath)) return { node, path, pos, textContent: node.textContent || "" };
    } else if (node.type.name === "struct_field") {
      const match = editableFieldInfoInNode(node, targetPath, pathPrefix.concat(node.attrs?.path || []), pos + 1);
      if (match) return match;
    } else if (node.type.name === "list_field") {
      const match = editableFieldInfoInListField(node, targetPath, pathPrefix.concat(node.attrs?.path || []), pos + 1);
      if (match) return match;
    } else if (node.childCount) {
      const match = editableFieldInfoInNode(node, targetPath, pathPrefix, pos + 1);
      if (match) return match;
    }

    offset += node.nodeSize;
  }

  return null;
}

function editableFieldInfoInListField(listField, targetPath, listPath, startPos) {
  let offset = 0;

  for (let index = 0; index < listField.childCount; index += 1) {
    const item = listField.child(index);
    const itemPos = startPos + offset;
    const itemPath = listPath.concat(index);
    const match = editableFieldInfoInNode(item, targetPath, itemPath, itemPos + 1);
    if (match) return match;
    offset += item.nodeSize;
  }
  return null;
}

export function editableFieldInfoForSource(source, doc = source.instance.doc) {
  const block = topLevelBlockInfoByIdOrIndex(doc, source.blockId, source.blockIndex);
  return block && editableFieldInfo(block, source.path || []);
}

export function samePath(left = [], right = []) {
  return JSON.stringify(left || []) === JSON.stringify(right || []);
}
