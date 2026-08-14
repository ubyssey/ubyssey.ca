import { findArticleBlock } from "../blocks/operations.js";

// Presence is stuff like the cursors and images at top
// In YJS called awareness as well for some reason

const FALLBACK_COLOR = "#f28c00";

// Previously locked blocks here, now just highlights selected
function renderBlockSelections(users, connectionId) {
  const root = document.querySelector("[data-article-shadow]")?.shadowRoot;
  if (!root) return;

  root.querySelectorAll(".pm-article-block--remote-selected").forEach((block) => {
    block.classList.remove("pm-article-block--remote-selected");
    block.style.removeProperty("--remote-editor-color");
  });
  for (const [id, user] of users) {
    if (id === connectionId || !user.selectedBlock) continue;
    const block = findArticleBlock(root, user.selectedBlock);
    if (!block) continue;

    block.classList.add("pm-article-block--remote-selected");
    block.style.setProperty("--remote-editor-color", user.colour);
  }
}

function renderUsers(container, users, connectionId) {
  const avatars = Array.from(users.values(), (user) => {
    const image = document.createElement("img");
    image.className = "manuscript-connected-users__avatar";
    if (user.avatarUrl) image.src = user.avatarUrl;
    image.alt = user.name;
    image.title = `${user.name} is editing`;
    image.style.borderColor = user.colour;
    return image;
  });

  container.replaceChildren(...avatars);

  const root = document.querySelector("[data-article-shadow]")?.shadowRoot;
  const localUser = users.get(connectionId);
  root?.host.style.setProperty("--current-editor-color", localUser?.colour || FALLBACK_COLOR);
  renderBlockSelections(users, connectionId);
}

function userState(awareness, currentUser) {
  if (!awareness) {
    return new Map([["local", {
      ...currentUser,
      avatarUrl: currentUser.avatar_url,
      colour: FALLBACK_COLOR,
      selectedBlock: null,
    }]]);
  }

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

export function setupUsers(container, currentUser, awareness) {
  const connectionId = awareness?.clientID ?? "local";
  let lastSelectedBlock = "";

  function renderBlockSelection() {
    renderBlockSelections(userState(awareness, currentUser), connectionId);
  }

  function render() {
    renderUsers(container, userState(awareness, currentUser), connectionId);
  }

  awareness?.on("change", render);
  render();

  return {
    renderBlockSelection,
    sendBlockSelection(selectedBlock) {
      const serialized = JSON.stringify(selectedBlock);
      if (serialized === lastSelectedBlock) return;

      lastSelectedBlock = serialized;
      awareness?.setLocalStateField("selectedBlock", selectedBlock || null);
    },
    destroy() {
      awareness?.off("change", render);
    },
  };
}
