import * as Y from "yjs";

// Handles YJS shared values

// Converts YJS to JS values
export function sharedValue(value) {
  if (value instanceof Y.Text) return value.toString();
  if (value instanceof Y.Array) return value.toArray().map(sharedValue);
  if (value instanceof Y.Map) return value.toJSON();
  return value;
}

export function sameValue(left, right) {
  return JSON.stringify(sharedValue(left)) === JSON.stringify(sharedValue(right));
}

export function newSharedText(value) {
  const text = new Y.Text();
  if (value) text.insert(0, String(value));
  return text;
}

// Updates Y.text by replacing only the changed portion
export function updateSharedText(metadata, text, nextValue) {
  const previous = text.toString();
  const next = String(nextValue ?? "");
  if (previous === next) return;

  let prefix = 0;
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < previous.length - prefix
    && suffix < next.length - prefix
    && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) suffix += 1;

  metadata.doc.transact(() => {
    const deleteLength = previous.length - prefix - suffix;
    if (deleteLength) text.delete(prefix, deleteLength);
    const insertion = next.slice(prefix, next.length - suffix);
    if (insertion) text.insert(prefix, insertion);
  }, "metadata-input");
}

// Maps cursor position through text replacement so cursor survives the remote update
export function mapUpdatedTextSelection(previous, next, position) {
  let prefix = 0;
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;

  while (
    suffix < previous.length - prefix
    && suffix < next.length - prefix
    && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) suffix += 1;

  const deletedTo = previous.length - suffix;
  const insertedLength = next.length - prefix - suffix;
  if (position <= prefix) return position;
  if (position >= deletedTo) return position + insertedLength - (deletedTo - prefix);
  return prefix + insertedLength;
}
