// ProseMirror snapshots for matching preview HTML to the current editor state

export function snapshotStreamDocuments(streamEditors) {
  const streamDocs = new Map();
  for (const instance of streamEditors) {
    streamDocs.set(instance.fieldName, instance.snapshot());
  }
  return streamDocs;
}
