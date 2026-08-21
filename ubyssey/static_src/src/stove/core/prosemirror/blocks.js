// Block Helpers
// Operations (insert, move, delete, etc) are mostly inside document.js

// Block ID is stable identifier, index is position within StreamField

// Returns descriptor (name, id, index) for each block in requested StreamField
export function blockDescriptors(streamEditors, fieldNames) {
  const descriptors = [];

  for (const fieldName of fieldNames) {
    const instance = streamEditors.find((item) => item.fieldName === fieldName);
    if (!instance) continue;

    for (let blockIndex = 0; blockIndex < instance.doc.childCount; blockIndex += 1) {
      const node = instance.doc.child(blockIndex);
      descriptors.push({
        fieldName,
        blockId: node.attrs?.id || "",
        blockIndex,
      });
    }
  }

  return descriptors;
}

export function sameBlock(left, right) {
  if (!left || !right || left.fieldName !== right.fieldName) return false;
  return left.blockId || right.blockId ? left.blockId === right.blockId : left.blockIndex === right.blockIndex;
}

function topLevelBlockInfo(doc, matcher) {
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

// Used for things like finding blocks after document changes, finding adjacent blocks for RichText keyboard nav
export function topLevelBlockInfoByIdOrIndex(doc, blockId, blockIndex) {
  if (blockId) return topLevelBlockInfo(doc, ({ node }) => node.attrs?.id === blockId);
  return topLevelBlockInfo(doc, ({ index }) => index === blockIndex);
}
