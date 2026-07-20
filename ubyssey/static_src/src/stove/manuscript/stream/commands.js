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
  const byId = blockId && topLevelBlockInfo(doc, ({ node }) => node.attrs?.id === blockId);
  return byId || topLevelBlockInfo(doc, ({ index }) => index === blockIndex);
}

export function moveTopLevelBlock(view, fromIndex, direction) {
  const targetIndex = fromIndex + direction;
  if (targetIndex < 0 || targetIndex >= view.state.doc.childCount) return false;

  const blocks = [];
  for (let index = 0; index < view.state.doc.childCount; index += 1) {
    blocks.push(view.state.doc.child(index));
  }

  [blocks[fromIndex], blocks[targetIndex]] = [blocks[targetIndex], blocks[fromIndex]];
  view.dispatch(view.state.tr.replaceWith(
    0,
    view.state.doc.content.size,
    Fragment.fromArray(blocks),
  ));
  return true;
}

export function deleteTopLevelBlock(view, info) {
  const { doc, tr } = view.state;

  if (doc.childCount <= 1) {
    // Creates RichTextBlock if streamfield is empty (maybe change for header)
    view.dispatch(tr.replaceWith(info.start, info.end, streamSchema.nodeFromJSON(createEmptyRichTextBlock())));
    return "replaced";
  }

  view.dispatch(tr.delete(info.start, info.end));
  return "deleted";
}
