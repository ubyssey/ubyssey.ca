// StreamField document operations

import { topLevelBlockInfoByIdOrIndex } from "./blocks.js";

export function findBlock(stream, descriptor) {
  return topLevelBlockInfoByIdOrIndex(
    stream.doc,
    descriptor.blockId,
    descriptor.blockIndex,
  );
}

export function moveBlock(stream, descriptor, direction) {
  const block = findBlock(stream, descriptor);
  if (!block) return null;

  const targetIndex = block.index + direction;
  const moved = stream.updateDoc((transaction) => {
    const current = topLevelBlockInfoByIdOrIndex(transaction.doc, descriptor.blockId, block.index);
    const target = topLevelBlockInfoByIdOrIndex(transaction.doc, null, targetIndex);
    if (!current || !target) return transaction;
    const destination = direction < 0 ? target.start : target.end;
    transaction.delete(current.start, current.end);
    return transaction.insert(transaction.mapping.map(destination), current.node);
  }, { kind: "structure" });

  return moved ? describeBlock(stream, targetIndex) : null;
}

export function deleteBlock(stream, descriptor) {
  const block = findBlock(stream, descriptor);
  if (!block) return false;

  return stream.updateDoc((transaction) => (
    transaction.doc.childCount === 1
      ? transaction.replaceWith(block.start, block.end, stream.createEmptyBlock())
      : transaction.delete(block.start, block.end)
  ));
}

// Inserts after (probably worth not appending after to the function name cause is the default)
export function insertBlock(stream, { after, block }) {
  const anchor = findBlock(stream, after);
  if (!anchor) return null;

  const inserted = stream.updateDoc((transaction) => transaction.insert(anchor.end, block));
  return inserted ? describeBlock(stream, anchor.index + 1) : null;
}

// Only actually used in the custom richtext actions
export function insertBlockBefore(stream, { before, block }) {
  const anchor = findBlock(stream, before);
  if (!anchor) return null;

  const inserted = stream.updateDoc((transaction) => transaction.insert(anchor.start, block));
  return inserted ? describeBlock(stream, anchor.index) : null;
}

export function setFieldContent(stream, { blockId, path = [], content }) {
  return stream.writeFieldContent(blockId, path, content);
}

export function setBlockContent(stream, descriptor, block) {
  const current = findBlock(stream, descriptor);
  if (!current) return false;

  return stream.updateDoc((transaction) => (
    transaction.replaceWith(current.start, current.end, block)), { kind: "content" });
}

function describeBlock(stream, blockIndex) {
  const node = stream.doc.child(blockIndex);
  return node && {
    fieldName: stream.fieldName,
    blockId: node.attrs.id || "",
    blockIndex,
  };
}

// Compare stream block structure before and after a transaction.
function streamBlocks(doc) {
  const blocks = [];
  doc.forEach((node, _offset, index) => {
    blocks.push({
      blockId: node.attrs?.id,
      blockIndex: index,
      blockType: node.attrs?.blockType,
      id: String(node.attrs?.id || ""),
      index,
      node,
    });
  });
  return blocks;
}

// Compares doc structure before and after, detects added/deleted/moved
export function diffStreamBlockStructure(beforeDoc, afterDoc) {
  const before = streamBlocks(beforeDoc);
  const after = streamBlocks(afterDoc);
  const beforeIds = before.map((block) => block.id);
  const afterIds = after.map((block) => block.id);
  const hasUniqueIds = (ids) => ids.every(Boolean) && new Set(ids).size === ids.length;
  const invalidIdentity = !hasUniqueIds(beforeIds) || !hasUniqueIds(afterIds);
  const structureChanged = (
    before.length !== after.length || before.some((block, index) => (
      block.id !== after[index]?.id || block.blockType !== after[index]?.blockType
    ))
  );

  if (!structureChanged) {
    return {
      after,
      before,
      deleted: [],
      inserted: [],
      invalidIdentity, // true if IDs are missing or duplicated
      moved: [],
      structureChanged,
      typeChanged: [],
    };
  }

  const beforeIdSet = new Set(beforeIds.filter(Boolean));
  const afterIdSet = new Set(afterIds.filter(Boolean));
  const beforeById = new Map(before.map((block) => [block.id, block]));
  const afterById = new Map(after.map((block) => [block.id, block]));
  const deleted = before.filter((block) => block.id && !afterIdSet.has(block.id));
  const inserted = after.filter((block) => block.id && !beforeIdSet.has(block.id));
  const typeChanged = invalidIdentity ? [] : after.filter((block) => (
    beforeById.has(block.id) && beforeById.get(block.id).blockType !== block.blockType
  ));
  const retainedBeforeIds = beforeIds.filter((id) => afterById.has(id));
  const retainedAfterIds = afterIds.filter((id) => beforeById.has(id));
  const moved = invalidIdentity ? [] : retainedAfterIds
    .filter((id, index) => retainedBeforeIds[index] !== id)
    .map((id) => afterById.get(id));

  return {
    after,
    before,
    deleted,
    inserted,
    invalidIdentity,
    moved,
    structureChanged,
    typeChanged,
  };
}
