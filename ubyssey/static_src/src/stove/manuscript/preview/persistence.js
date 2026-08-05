import { manuscriptSession } from "../session.js";
import { clone, pmDocToStreamValue } from "../stream/index.jsx";

const EMPTY_RICH_TEXT = [{ type: "paragraph" }];

/*
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
export function currentStreamDocs({ includePreviewEdits = true } = {}) {
  const streamDocs = new Map();
  for (const instance of manuscriptSession.streamEditors) {
    const nextDoc = clone(instance.view.state.doc.toJSON());
    const blocks = nextDoc.content || [];

    if (includePreviewEdits) {
      for (const editor of manuscriptSession.articleRichTextEditors.filter((item) => item.fieldName === instance.fieldName)) {
        const block = (editor.blockId && blocks.find((node) => node.attrs?.id === editor.blockId)) || (!editor.blockId && blocks[editor.blockIndex]);
        const field = (block?.content || []).find((child) => child.type === "editable_field" && child.attrs?.mode === "richtext");
        if (field) field.content = editor.view.state.doc.toJSON().content || EMPTY_RICH_TEXT;
      }
    }

    streamDocs.set(instance.fieldName, nextDoc);
  }
  return streamDocs;
}

// Serializes every stream editor into its hidden textarea for preview/save
export function writeStreamTextareas(streamDocs = currentStreamDocs()) {
  for (const instance of manuscriptSession.streamEditors) {
    instance.textarea.value = JSON.stringify(pmDocToStreamValue(streamDocs.get(instance.fieldName)), null, 2);
  }
  return streamDocs;
}
