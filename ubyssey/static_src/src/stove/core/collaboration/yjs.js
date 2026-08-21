import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

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

// Creates Y.doc, and sends initial update (this allows reconnections to work) and handles response (gets new remote changes)
export async function connectYjs({ initialUpdate, currentEditor, initializationUrl, websocketUrl }) {
  const ydoc = new Y.Doc();

  try {
    const response = await fetch(initializationUrl, {
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
    return { ydoc, awareness: null, provider: null };
  }

  const provider = new WebsocketProvider(
    websocketUrl,
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

  // Restores currently reload for everyone so potentially pretty dangerous (not sure how else to implement)
  provider.on("connection-close", (event) => {
    if (event.code === RESTORE_CLOSE_CODE) window.location.reload();
  });

  window.addEventListener("pagehide", () => {
    provider.awareness.setLocalState(null);
    provider.destroy();
  }, { once: true });
  return { ydoc, awareness: provider.awareness, provider };
}
