import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import * as decoding from "lib0/decoding";
import * as buffer from "lib0/buffer";

// See consumers.py, code sent on restore
const RESTORE_CLOSE_CODE = 4410;
const WAGTAIL_EDITING_CLOSE_CODE = 4411;

// Sends message that changes were merged in
const PERSISTENCE_ACK_MESSAGE = 4;
const PERSISTENCE_ERROR_MESSAGE = 5;
const PENDING_UPDATES_PERSIST_DELAY = 250;

function pendingUpdatesStorageKey(collaborationId, userId) {
  return `stove-yjs-pending:${collaborationId}:${userId}`;
}

// Stores local updates that haven't been confirmed by server in localstorage
function createPendingUpdatesStore({ ydoc, collaborationId, userId }) {
  const key = pendingUpdatesStorageKey(collaborationId, userId);
  let pendingDoc = new Y.Doc();
  let persistenceTimer = null;
  let hasPendingUpdates = false;

  // Prevents empty updates
  function hasUpdate(update) {
    const { structs, ds } = Y.decodeUpdate(update);
    return structs.length > 0 || ds.clients.size > 0;
  }

  try {
    const stored = window.localStorage.getItem(key);
    if (stored) {
      const update = buffer.fromBase64(stored);
      Y.applyUpdate(ydoc, update);
      Y.applyUpdate(pendingDoc, update);
      hasPendingUpdates = hasUpdate(update);
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

  const cancelScheduledPersist = () => {
    if (persistenceTimer === null) return;
    window.clearTimeout(persistenceTimer);
    persistenceTimer = null;
  };

  // Debounce to avoid lots of writes
  const schedulePersist = () => {
    cancelScheduledPersist();
    persistenceTimer = window.setTimeout(() => {
      persistenceTimer = null;
      persist();
    }, PENDING_UPDATES_PERSIST_DELAY);
  };

  const removePersistedUpdates = () => {
    cancelScheduledPersist();
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn("Unable to clear persisted collaborative changes", error);
    }
  };

  return {
    record(update) {
      Y.applyUpdate(pendingDoc, update);
      hasPendingUpdates = hasPendingUpdates || hasUpdate(update);
      schedulePersist();
    },
    // Removes server acknowledged updates from pendingDoc
    acknowledge(stateVector) {
      const remainingUpdate = Y.encodeStateAsUpdate(pendingDoc, stateVector);
      const hadPendingUpdates = hasPendingUpdates;

      pendingDoc.destroy();
      pendingDoc = new Y.Doc();
      
      if (!hasUpdate(remainingUpdate)) {
        hasPendingUpdates = false;
        removePersistedUpdates();
        return hadPendingUpdates;
      }

      Y.applyUpdate(pendingDoc, remainingUpdate);
      hasPendingUpdates = true;
      schedulePersist();
      return false;
    },
    // Flush bypasses the debounce and immediately persists
    flush() {
      cancelScheduledPersist();
      if (hasPendingUpdates) persist();
      else removePersistedUpdates();
    },
    clear() {
      pendingDoc.destroy();
      pendingDoc = new Y.Doc();
      hasPendingUpdates = false;
      removePersistedUpdates();
    },
  };
}

export function collaborationSnapshot(ydoc, collaborationId = null) {
  return {
    collaborationId,
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

// Creates the collaboration object
// - ydoc: the yjs document
// - provider: the websocket provider
// - awareness: users/selections
// - collaborationSnapshot(): the full document as a yjs update and collaboration id which is the primary key for the PageCollaboration model
export async function connectYjs({ initialUpdate, currentEditor, initializationUrl, websocketUrl, onPageHide }) {
  const ydoc = new Y.Doc();
  let presenceId = crypto.randomUUID();
  let collaborationId = null;

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

    if (!response.ok) throw new Error(`Collaboration initialization failed (${response.status})`);
    collaborationId = response.headers.get("X-Stove-Collaboration-Id");
    if (!collaborationId) throw new Error("Collaboration initialization did not return a document id");
    Y.applyUpdate(ydoc, new Uint8Array(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    ydoc.destroy();
    return null;
  }

  const pendingUpdates = createPendingUpdatesStore({
    ydoc,
    collaborationId,
    userId: currentEditor.id,
  });

  const provider = new WebsocketProvider(
    websocketUrl,
    "yjs",
    ydoc,
    { params: { presence: presenceId, collaboration: collaborationId } },
  );

  provider.messageHandlers[PERSISTENCE_ACK_MESSAGE] = (_encoder, decoder) => {
    // Ignore old server style acks
    if (!decoding.hasContent(decoder)) return;
    const stateVector = decoding.readTailAsUint8Array(decoder);
    pendingUpdates.acknowledge(stateVector);
    provider.emit("persistence-ack", []);
  };

  provider.messageHandlers[PERSISTENCE_ERROR_MESSAGE] = () => {
    provider.emit("persistence-error", []);
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
      provider.shouldConnect = false;
      pendingUpdates.clear();
      window.location.reload();
      return;
    }
    if (event?.code === WAGTAIL_EDITING_CLOSE_CODE) {
      provider.shouldConnect = false;
      pendingUpdates.clear();
      const form = document.querySelector("[data-page-form]");
      if (form.dataset.wagtailHandoffPending) return;
      window.location.assign(form.dataset.stoveHomeUrl || "/stove/");
      return;
    }
    if (event) {
      presenceId = crypto.randomUUID();
      provider.params.presence = presenceId;
    }
  });

  window.addEventListener("pagehide", (event) => {
    onPageHide?.();
    pendingUpdates.flush();
    provider.awareness.setLocalState(null);
    if (event.persisted) provider.disconnect();
    else provider.destroy();
  });

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    window.location.reload();
  });
  return {
    ydoc,
    awareness: provider.awareness,
    provider,
    collaborationSnapshot: () => collaborationSnapshot(ydoc, collaborationId),
  };
}
