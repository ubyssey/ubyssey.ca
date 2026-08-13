// Prosemirror block actions

// Find/Move/Delete/Calculate range of blocks

import { Fragment } from "prosemirror-model";

import { createEmptyRichTextBlock } from "./serialization.js";
import { streamSchema } from "./schema.js";

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

export function topLevelBlockInfoAtPos(doc, pos) {
  return topLevelBlockInfo(doc, ({ start }) => pos === start);
}

export function topLevelBlockInfoByIdOrIndex(doc, blockId, blockIndex) {
  if (blockId) return topLevelBlockInfo(doc, ({ node }) => node.attrs?.id === blockId);
  return topLevelBlockInfo(doc, ({ index }) => index === blockIndex);
}

export function moveTopLevelBlock(transaction, fromIndex, direction) {
  const targetIndex = fromIndex + direction;
  if (targetIndex < 0 || targetIndex >= transaction.doc.childCount) return null;

  const from = topLevelBlockInfoByIdOrIndex(transaction.doc, null, fromIndex);
  const target = topLevelBlockInfoByIdOrIndex(transaction.doc, null, targetIndex);
  const blocks = direction < 0 ? [from.node, target.node] : [target.node, from.node];
  return transaction.replaceWith(
    Math.min(from.start, target.start),
    Math.max(from.end, target.end),
    Fragment.fromArray(blocks),
  );
}

export function deleteTopLevelBlock(transaction, info) {
  if (transaction.doc.childCount <= 1) {
    // Creates RichTextBlock if streamfield is empty (maybe change for header)
    return transaction.replaceWith(info.start, info.end, streamSchema.nodeFromJSON(createEmptyRichTextBlock()));
  }

  return transaction.delete(info.start, info.end);
}
