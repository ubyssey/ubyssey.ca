import * as Y from "yjs";
import { prosemirrorJSONToYDoc } from "y-prosemirror";

import { connectYjs } from "./yjs.js";
import { streamBlockToPmNode } from "../prosemirror/serialization.js";
import { streamSchema } from "../prosemirror/stream_schema.js";
import { normalizeSharedStreamDocuments } from "../prosemirror/stream_normalization.js";

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

export async function setupPageCollaboration({createEmptyBlock, currentEditor, initializationUrl, initializeSharedData = () => ({}), streamEditors, presenceUrl, websocketUrl, onPageHide}) {
  const form = document.querySelector("[data-page-form]");
  form.inert = true;

  const collaboration = await connectYjs({
    initialUpdate: initialYjsUpdate(streamEditors, createEmptyBlock, initializeSharedData),
    currentEditor,
    initializationUrl,
    presenceUrl,
    websocketUrl,
    onPageHide,
  });

  if (!collaboration) {
    const message = document.createElement("div");
    message.setAttribute("role", "alert");

    const heading = document.createElement("h1");
    heading.textContent = "Could not connect to Stove";

    const description = document.createElement("p");
    description.textContent = "Check your connection and try again.";

    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Try again";
    retry.addEventListener("click", () => window.location.reload());

    message.append(heading, description, retry);
    form.replaceWith(message);
    return null;
  }

  // Check and fix stream docs before mounting
  normalizeSharedStreamDocuments(collaboration.ydoc, streamEditors);
  form.inert = false;

  return {
    ...collaboration,
    ...initializeSharedData(collaboration.ydoc),
  };
}
