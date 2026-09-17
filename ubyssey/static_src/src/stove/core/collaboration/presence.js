// Renders presence, ie user avatars at top, and selected blocks
// YJS calls it awareness
// Editor Cursors not handled here (they use yCursorPlugin)

const FALLBACK_COLOR = "#f28c00";

function getConnectedUsers(awareness, currentUser) {
  // Fallback
  if (!awareness) {
    return new Map([["local", {
      ...currentUser,
      avatarUrl: currentUser.avatar_url,
      colour: FALLBACK_COLOR,
      selectedBlock: null,
    }]]);
  }

  // Gets map of connected users
  return new Map(Array.from(awareness.getStates(), ([clientId, state]) => {
    const user = state.user || {};
    return [clientId, {
      id: user.id,
      name: user.name || `Editor ${clientId}`,
      avatarUrl: user.avatarUrl || user.avatar_url || "",
      colour: user.color || FALLBACK_COLOR,
      selectedBlock: state.selectedBlock || null,
    }];
  }));
}

function renderUsers(container, users) {
  const avatars = Array.from(users.values(), (user) => {
    const image = document.createElement("img");
    image.className = "stove-connected-users__avatar";
    if (user.avatarUrl) image.src = user.avatarUrl;
    image.alt = user.name;
    image.title = `${user.name} is editing`;
    image.style.borderColor = user.colour;
    return image;
  });

  container.replaceChildren(...avatars);
}

function renderPresence(users, connectionId, findBlock) {
  const root = document.querySelector("[data-page-shadow]")?.shadowRoot;
  const localUser = users.get(connectionId);
  root?.host.style.setProperty("--current-editor-color", localUser?.colour || FALLBACK_COLOR);
  if (root) {
    root.querySelectorAll(".pm-block--remote-selected").forEach((block) => {
      block.classList.remove("pm-block--remote-selected");
      block.style.removeProperty("--remote-editor-color");
    });

    for (const [id, user] of users) {
      if (id === connectionId || !user.selectedBlock) continue;
      const block = findBlock(root, user.selectedBlock);
      if (!block) continue;

      block.classList.add("pm-block--remote-selected");
      block.style.setProperty("--remote-editor-color", user.colour);
    }
  }
}

export function setupPresence(container, currentUser, awareness, { findBlock, homeUrl } = {}) {
  const connectionId = awareness?.clientID ?? "local";
  let lastSelectedBlock = "";
  let kickClearTimer = null;
  let redirecting = false;

  const stoveHomeUrl = homeUrl || document.querySelector("[data-page-form]")?.dataset.stoveHomeUrl || "/";

  function renderBlockSelection() {
    renderPresence(getConnectedUsers(awareness, currentUser), connectionId, findBlock);
  }

  function render() {
    const users = getConnectedUsers(awareness, currentUser);
    renderUsers(container, users);
    renderPresence(users, connectionId, findBlock);
  }

  function announceLocalState() {
    const state = awareness?.getLocalState();
    if (state) awareness.setLocalState(state);
  }

  function handleAwarenessChange(change, origin) {
    render();
    if (origin !== "local" && change?.added?.length) announceLocalState();

    if (origin === "local" || redirecting) return;

    const changedClientIds = [
      ...(change?.added || []),
      ...(change?.updated || []),
    ];
    const anotherUserWasKicked = changedClientIds.some((clientId) => {
      if (clientId === connectionId) return false;
      return Boolean(awareness?.getStates().get(clientId)?.stoveKickToken);
    });

    if (!anotherUserWasKicked) return;
    redirecting = true;
    window.location.assign(stoveHomeUrl);
  }

  awareness?.on("change", handleAwarenessChange);
  render();
  announceLocalState();

  return {
    renderBlockSelection,
    sendBlockSelection(selectedBlock) {
      const serialized = JSON.stringify(selectedBlock);
      if (serialized === lastSelectedBlock) return;

      lastSelectedBlock = serialized;
      awareness?.setLocalStateField("selectedBlock", selectedBlock || null);
    },
    kickOtherUsers() {
      if (!awareness) return false;

      const token = String(Date.now()) + "-" + String(Math.random());
      awareness.setLocalStateField("stoveKickToken", token);
      clearTimeout(kickClearTimer);
      kickClearTimer = window.setTimeout(() => {
        if (awareness.getLocalState()?.stoveKickToken === token) {
          awareness.setLocalStateField("stoveKickToken", null);
        }
      }, 1000);
      return true;
    },
    destroy() {
      clearTimeout(kickClearTimer);
      awareness?.off("change", handleAwarenessChange);
    },
  };
}
