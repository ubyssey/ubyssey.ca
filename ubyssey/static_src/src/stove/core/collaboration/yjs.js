import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import * as decoding from "lib0/decoding";
import * as buffer from "lib0/buffer";

// See consumers.py, code sent on restore
const RESTORE_CLOSE_CODE = 4410;
const WAGTAIL_EDITING_CLOSE_CODE = 4411;

// Sends message that changes were merged in
const PERSISTENCE_ACK_MESSAGE = 4;

function pendingUpdatesStorageKey(collaborationId, userId) {
  return `stove-yjs-pending:${collaborationId}:${userId}`;
}

// Stores local updates that haven't been confirmed by server in localstorage
function createPendingUpdatesStore({ ydoc, collaborationId, userId, fallbackCollaborationId = null }) {
  const key = pendingUpdatesStorageKey(collaborationId, userId);
  const fallbackKey = fallbackCollaborationId ? pendingUpdatesStorageKey(fallbackCollaborationId, userId) : null;
  let pendingDoc = new Y.Doc();
  let restoredFallback = false;

  try {
    for (const storageKey of [key, fallbackKey]) {
      if (!storageKey || (storageKey === key && fallbackKey === key)) continue;
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) continue;
      const update = buffer.fromBase64(stored);
      Y.applyUpdate(ydoc, update);
      Y.applyUpdate(pendingDoc, update);
      if (storageKey === fallbackKey) restoredFallback = true;
    }
  } catch (error) {
    console.warn("Unable to restore pending collaborative changes", error);
  }

  const persist = () => {
    try {
      window.localStorage.setItem(key, buffer.toBase64(Y.encodeStateAsUpdate(pendingDoc)));
    } catch (error) {
      console.warn("Unable to preserve pending collaborative changes", error);
    }
  };

  if (restoredFallback && fallbackKey && fallbackKey !== key) {
    persist();
    try {
      window.localStorage.removeItem(fallbackKey);
    } catch (error) {
      console.warn("Unable to migrate pending collaborative changes", error);
    }
  }

  return {
    record(update) {
      Y.applyUpdate(pendingDoc, update);
      persist();
    },
    acknowledge(stateVector) {
      if (Y.encodeStateAsUpdate(pendingDoc, stateVector).byteLength) return;
      pendingDoc.destroy();
      pendingDoc = new Y.Doc();
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        console.warn("Unable to clear persisted collaborative changes", error);
      }
    },
    clear() {
      pendingDoc.destroy();
      pendingDoc = new Y.Doc();
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        console.warn("Unable to clear persisted collaborative changes", error);
      }
    },
  };
}

export function collaborationSnapshot(ydoc) {
  return {
    stateVector: buffer.toBase64(Y.encodeStateVector(ydoc)),
    update: buffer.toBase64(Y.encodeStateAsUpdate(ydoc)),
  };
}

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
export async function connectYjs({ initialUpdate, currentEditor, initializationUrl, presenceUrl, websocketUrl }) {
  const ydoc = new Y.Doc();
  const presenceId = crypto.randomUUID();
  const fallbackCollaborationId = `uninitialized:${websocketUrl}`;
  let collaborationId = null;

  const updatePresence = (action) => fetch(presenceUrl, {
    method: "POST",
    credentials: "same-origin",
    keepalive: action === "release",
    headers: {
      "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value || "",
    },
    body: new URLSearchParams({ action, presence: presenceId }),
  });

  const startOfflineRecovery = () => {
    const pendingUpdates = createPendingUpdatesStore({
      ydoc,
      collaborationId: fallbackCollaborationId,
      userId: currentEditor.id,
    });
    ydoc.on("update", (update) => pendingUpdates.record(update));
    return {
      ydoc,
      awareness: null,
      provider: null,
      collaborationSnapshot: () => collaborationSnapshot(ydoc),
    };
  };

  try {
    const initializationRequestUrl = new URL(initializationUrl, window.location.origin);
    initializationRequestUrl.searchParams.set("presence", presenceId);

    const response = await fetch(initializationRequestUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]")?.value || "",
      },
      body: initialUpdate,
    });

    if (response.status === 409) {
      return { blockedByWagtail: true };
    }

    if (!response.ok) throw new Error(`Collaboration initialization failed (${response.status})`);
    Y.applyUpdate(ydoc, new Uint8Array(await response.arrayBuffer()));
    collaborationId = response.headers.get("X-Stove-Collaboration-Id");
  } catch (error) {
    console.error(error);
    Y.applyUpdate(ydoc, initialUpdate);
    return startOfflineRecovery();
  }

  if (!collaborationId) {
    console.error("Collaboration initialization did not return a document id");
    return startOfflineRecovery();
  }

  const pendingUpdates = createPendingUpdatesStore({
    ydoc,
    collaborationId,
    fallbackCollaborationId,
    userId: currentEditor.id,
  });

  const provider = new WebsocketProvider(
    websocketUrl,
    "yjs",
    ydoc,
    { params: { presence: presenceId } },
  );

  provider.messageHandlers[PERSISTENCE_ACK_MESSAGE] = (_encoder, decoder) => {
    // Ignore old server style acks
    if (!decoding.hasContent(decoder)) return;
    const stateVector = decoding.readTailAsUint8Array(decoder);
    pendingUpdates.acknowledge(stateVector);
    provider.emit("persistence-ack", []);
  };

  ydoc.on("update", (update, origin) => {
    if (origin !== provider) pendingUpdates.record(update);
  });

  const user = {
    id: currentEditor.id,
    name: currentEditor.name,
    avatarUrl: currentEditor.avatar_url,
    color: editorColour(currentEditor.id),
  };
  provider.awareness.setLocalStateField("user", user);

  // Restores currently reload for everyone so potentially pretty dangerous (not sure how else to implement)
  provider.on("connection-close", (event) => {
    if (event?.code === RESTORE_CLOSE_CODE) {
      pendingUpdates.clear();
      window.location.reload();
    }
    if (event?.code === WAGTAIL_EDITING_CLOSE_CODE) {
      pendingUpdates.clear();
      window.location.assign(document.querySelector("[data-page-form]").dataset.stoveHomeUrl || "/stove/");
    }
  });

  window.addEventListener("pagehide", (event) => {
    updatePresence("release").catch(() => {});
    provider.awareness.setLocalState(null);
    if (event.persisted) provider.disconnect();
    else provider.destroy();
  });

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    updatePresence("claim")
      .then((response) => {
        if (!response.ok) throw new Error("Unable to resume Stove editor");
        provider.connect();
        provider.awareness.setLocalStateField("user", user);
      })
      .catch((error) => console.warn(error));
  });
  return {
    ydoc,
    awareness: provider.awareness,
    provider,
    collaborationSnapshot: () => collaborationSnapshot(ydoc),
  };
}
