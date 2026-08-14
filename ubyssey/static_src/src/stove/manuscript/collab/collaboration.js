import * as Y from "yjs";
import { prosemirrorJSONToYDoc } from "y-prosemirror";
import { WebsocketProvider } from "y-websocket";

import { seedMetadata } from "./metadata/index.js";
import { createEmptyRichTextBlock, streamBlockToPmNode } from "../stream/serialization.js";
import { streamSchema } from "../stream/schema.js";

// See consumers.py, code sent on restore
const RESTORE_CLOSE_CODE = 4410;

// Sends message that changes were merged in
const PERSISTENCE_ACK_MESSAGE = 4;

const date = new Date().getDate();
const EDITOR_COLOURS = [
  "#9ec756",
  "#f1b643",
  "#3564a8",
  "#d23723",
];

// Unless someone has an idea for mapping integers to RGB
function editorColour(id) {
  return EDITOR_COLOURS[(Number(id) + date) % EDITOR_COLOURS.length];
}

// Default Initial PM doc
function initialProseMirrorDoc(streamEditor) {
  const content = (streamEditor.blocks || []).map(streamBlockToPmNode);
  return {
    type: "doc",
    content: content.length ? content : [createEmptyRichTextBlock()],
  };
}

// Applies the page data as transformations on the default doc
function initialYjsUpdate(streamEditors, form) {
  const combined = new Y.Doc();

  Object.entries(streamEditors).forEach(([fieldName, streamEditor]) => {
    const fieldDoc = prosemirrorJSONToYDoc(
      streamSchema,
      initialProseMirrorDoc(streamEditor),
      fieldName,
    );
    Y.applyUpdate(combined, Y.encodeStateAsUpdate(fieldDoc));
  });

  seedMetadata(combined, form);
  return Y.encodeStateAsUpdate(combined);
}

export async function setupCollaboration(pageId, streamEditors, currentEditor, form) {
  const initialUpdate = initialYjsUpdate(streamEditors, form);
  const ydoc = new Y.Doc();

  try {
    const response = await fetch(`/stove/page/${pageId}/collaboration`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]")?.value || "",
      },
      body: initialUpdate,
    });
    if (!response.ok) throw new Error(`Collaboration initialization failed (${response.status})`);
    Y.applyUpdate(ydoc, new Uint8Array(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    Y.applyUpdate(ydoc, initialUpdate);
    const metadata = seedMetadata(ydoc, form);
    return { ydoc, metadata, awareness: null, provider: null };
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const metadata = seedMetadata(ydoc, form);

  const provider = new WebsocketProvider(
    `${protocol}//${window.location.host}/ws/stove/manuscript/${pageId}`,
    "yjs",
    ydoc,
  );

  provider.messageHandlers[PERSISTENCE_ACK_MESSAGE] = () => {
    provider.emit("persistence-ack", []);
  };

  provider.awareness.setLocalStateField("user", {
    id: currentEditor.id,
    name: currentEditor.name,
    avatarUrl: currentEditor.avatar_url,
    color: editorColour(currentEditor.id),
  });

  provider.on("connection-close", (event) => {
    if (event.code === RESTORE_CLOSE_CODE) window.location.reload();
  });

  window.addEventListener("beforeunload", () => provider.destroy(), { once: true });
  return { ydoc, metadata, awareness: provider.awareness, provider };
}
