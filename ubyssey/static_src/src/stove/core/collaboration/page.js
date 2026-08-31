import * as Y from "yjs";
import { prosemirrorJSONToYDoc } from "y-prosemirror";

import { connectYjs } from "./yjs.js";
import { streamBlockToPmNode } from "../prosemirror/serialization.js";
import { streamSchema } from "../prosemirror/stream_schema.js";

function initialProseMirrorDoc(fieldName, streamEditor, createEmptyBlock) {
  const content = (streamEditor.blocks || []).map(streamBlockToPmNode);
  const emptyBlock = createEmptyBlock(fieldName, streamEditor);
  return {
    type: "doc",
    content: content.length ? content : [
      typeof emptyBlock.toJSON === "function" ? emptyBlock.toJSON() : emptyBlock,
    ],
  };
}

function initialYjsUpdate(streamEditors, createEmptyBlock, initializeSharedData) {
  const combined = new Y.Doc();

  Object.entries(streamEditors).forEach(([fieldName, streamEditor]) => {
    const fieldDoc = prosemirrorJSONToYDoc(
      streamSchema,
      initialProseMirrorDoc(fieldName, streamEditor, createEmptyBlock),
      fieldName,
    );
    Y.applyUpdate(combined, Y.encodeStateAsUpdate(fieldDoc));
  });

  initializeSharedData(combined);
  return Y.encodeStateAsUpdate(combined);
}

export async function setupPageCollaboration({createEmptyBlock, currentEditor, initializationUrl, initializeSharedData = () => ({}), streamEditors, websocketUrl}) {
  const collaboration = await connectYjs({
    initialUpdate: initialYjsUpdate(streamEditors, createEmptyBlock, initializeSharedData),
    currentEditor,
    initializationUrl,
    websocketUrl,
  });

  return {
    ...collaboration,
    ...initializeSharedData(collaboration.ydoc),
  };
}
