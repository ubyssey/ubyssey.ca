// Finds range of given mark (ie bold, or link), which can be spread over several children

// findCommentThread does comment equivelent

export function markRangeAtCursor(state, markType, attrs = null) {
  // Get Parent, usually paragraph or other text block containing cursor
  const { $from } = state.selection;
  const parent = $from.parent;
  const offset = $from.parentOffset;
  let pos = 0;
  let match = null;
  let matchIndex = -1;
  let matchStart = 0;

  // Find the marked child under the cursor, walks through parents children
  for (let index = 0; index < parent.childCount; index += 1) {
    const child = parent.child(index);
    const start = pos;
    const end = start + child.nodeSize;
    const mark = markType.isInSet(child.marks);
    if (mark && (!attrs || sameMarkAttrs(mark.attrs, attrs)) && start <= offset && offset <= end) {
      match = mark;
      matchIndex = index;
      matchStart = start;
      break;
    }
    pos = end;
  }

  if (!match) return null;

  // Start with matched child range
  let fromOffset = matchStart;
  let toOffset = matchStart + parent.child(matchIndex).nodeSize;

  // Expand to matching nodes on left, then right
  for (let index = matchIndex - 1; index >= 0; index -= 1) {
    const child = parent.child(index);
    const mark = markType.isInSet(child.marks);
    if (!mark || !sameMarkAttrs(mark.attrs, match.attrs)) break;
    fromOffset -= child.nodeSize;
  }

  for (let index = matchIndex + 1; index < parent.childCount; index += 1) {
    const child = parent.child(index);
    const mark = markType.isInSet(child.marks);
    if (!mark || !sameMarkAttrs(mark.attrs, match.attrs)) break;
    toOffset += child.nodeSize;
  }

  // Convert from relative to doc positions
  const parentStart = $from.start();
  return { from: parentStart + fromOffset, to: parentStart + toOffset, attrs: match.attrs };
}

function sameMarkAttrs(left, right) {
  return JSON.stringify(left || {}) === JSON.stringify(right || {});
}
