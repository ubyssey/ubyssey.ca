import * as Y from "yjs";
import { prosemirrorJSONToYDoc } from "y-prosemirror";
import { WebsocketProvider } from "y-websocket";

import { seedMetadata } from "./metadata/index.js";
import { createEmptyRichTextBlock, streamBlockToPmNode } from "../stream/serialization.js";
import { streamSchema } from "../stream/schema.js";

// See consumers.py, code sent on restore
const RESTORE_CLOSE_CODE = 4410;

const date = new Date().getDate();

// Different colour each day of the month for each user lol
function editorColour(id) {
  return `hsl(${((Number(id) + date) * 137.5) % 360} 70% 40%)`;
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

  provider.awareness.setLocalStateField("user", {
    id: currentEditor.id,
    name: currentEditor.name,
    avatarUrl: currentEditor.avatar_url,
    color: editorColour(currentEditor.id),
  });

  provider.ws.addEventListener("close", (event) => {
    if (event.code === RESTORE_CLOSE_CODE) window.location.reload();
  });

  window.addEventListener("beforeunload", () => provider.destroy(), { once: true });
  return { ydoc, metadata, awareness: provider.awareness, provider };
}
