// Streamfield Document Helpers (this could maybe be moved as it is a bit unfocused right now)

import { pmDocToStreamValue } from "./serialization.js";

export function snapshotStreamDocuments(streamEditors) {
  const streamDocs = new Map();
  for (const instance of streamEditors) {
    streamDocs.set(instance.fieldName, instance.snapshot());
  }
  return streamDocs;
}

// Serializes form JSON from Prosemirror to Wagtail JSON for server
export function appendStreamDocumentsToFormData(formData, streamDocs) {
  // Each doc is a streamfield like header or content for manuscript
  for (const [fieldName, doc] of streamDocs) {
    formData.set(`stream_${fieldName}`, JSON.stringify(pmDocToStreamValue(doc), null, 2));
  }
}

export function formDataWithStreamDocuments(form, streamDocs) {
  const formData = new FormData(form);
  appendStreamDocumentsToFormData(formData, streamDocs);
  return formData;
}
