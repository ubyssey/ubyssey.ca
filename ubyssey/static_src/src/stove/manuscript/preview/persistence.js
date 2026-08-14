import { manuscriptSession } from "../session.js";
import { clone, pmDocToStreamValue } from "../stream/index.jsx";
/*
This is somewhat old now, but I'm going to keep it as a reference
The backing stream editor/preview editor design has been replaced with a YJS Xml node structure

Currently the right sidebar (though I think I might have moved it, though it doesn't really matter), contains
the actual editor fields, which are hidden, and are what is returned on a save

If sidebar contains:

{
  type: "stream_block",
  attrs: {
    id: "abc",
    blockType: "richtext",
  },
  content: [{
    type: "editable_field",
    attrs: {
      mode: "richtext",
    },
    content: [{
      type: "paragraph",
      content: [{
        type: "text",
        text: "Old text",
      }],
    }],
  }],
}

and the preview editor contains 
{
  type: "doc",
  content: [{
    type: "paragraph",
    content: [{
      type: "text",
      text: "Updated text",
    }],
  }],
}

this clones the stream document and changes it's field to
content: [{
  type: "paragraph",
  content: [{
    type: "text",
    text: "Updated text",
  }],
}]

writeStreamTextareas handles the actual writeback
*/

// Now just clones each stream instances shared document
// TODO rename, and potentially remove
export function currentStreamDocs() {
  const streamDocs = new Map();
  for (const instance of manuscriptSession.streamEditors) {
    streamDocs.set(instance.fieldName, clone(instance.doc.toJSON()));
  }
  return streamDocs;
}

export function writeStreamTextarea(instance, doc = instance.doc) {
  const json = typeof doc.toJSON === "function" ? doc.toJSON() : doc;
  instance.textarea.value = JSON.stringify(pmDocToStreamValue(json), null, 2);
}

// Serializes every stream editor into its hidden textarea for preview/save
export function writeStreamTextareas(streamDocs = currentStreamDocs()) {
  for (const instance of manuscriptSession.streamEditors) {
    writeStreamTextarea(instance, streamDocs.get(instance.fieldName));
  }
  return streamDocs;
}
