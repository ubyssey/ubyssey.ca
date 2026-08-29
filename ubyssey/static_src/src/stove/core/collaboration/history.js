// Shared History for entire page Y.Doc

import * as Y from "yjs";
import { defaultDeleteFilter, defaultProtectedNodes, ySyncPluginKey } from "y-prosemirror";

export class StreamModelUpdate {
  constructor(change) {
    this.change = change;
  }
}

export function createPageHistory(ydoc, streamFieldNames) {
  const manager = new Y.UndoManager([
    ...streamFieldNames.map((fieldName) => ydoc.getXmlFragment(fieldName)),
    ydoc.getMap("metadata"),
  ], {
    trackedOrigins: new Set([
      ySyncPluginKey,
      StreamModelUpdate,
      "metadata-input",
      "metadata-authors",
    ]),
    deleteFilter: (item) => defaultDeleteFilter(item, defaultProtectedNodes),
    captureTransaction: (transaction) => transaction.meta.get("addToHistory") !== false,
  });

  return {
    canUndo: () => manager.undoStack.length > 0,
    canRedo: () => manager.redoStack.length > 0,
    undo: () => {
      if (!manager.undoStack.length) return false;
      manager.undo();
      return true;
    },
    redo: () => {
      if (!manager.redoStack.length) return false;
      manager.redo();
      return true;
    },
    stopCapturing: () => { manager.stopCapturing(); },
  };
}
