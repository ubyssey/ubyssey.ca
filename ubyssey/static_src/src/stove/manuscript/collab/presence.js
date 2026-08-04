import { findArticleBlock } from "../blocks/operations.js";
import { manuscriptSession } from "../session.js";
import { clearDocumentCursors, renderPlainTextCursor, renderRichTextCursor } from "./cursors.js";

// Presence is stuff like the cursors and images at top
// In YJS called awareness as well for some reason

const FALLBACK_COLOR = "#f28c00";

// Border + Calls Render Cursor
function renderEditorLocations(users, connectionId) {
  const root = document.querySelector("[data-article-shadow]")?.shadowRoot;
  if (!root) return;

  root.querySelectorAll(".pm-article-block--remote-selected").forEach((block) => {
    block.classList.remove("pm-article-block--remote-selected");
    block.style.removeProperty("--remote-editor-color");
  });
  root.querySelectorAll(".pm-remote-cursor, .pm-remote-selection").forEach((marker) => { marker.remove(); });
  clearDocumentCursors();

  for (const [id, user] of users) {
    if (id === connectionId || !user.selection) continue;
    const block = findArticleBlock(root, user.selection);
    if (!block) continue;

    block.classList.add("pm-article-block--remote-selected");
    block.style.setProperty("--remote-editor-color", user.colour);
    if (user.selection.kind === "plainText") renderPlainTextCursor(root, user, block);
    else renderRichTextCursor(root, user, block);
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
  renderEditorLocations(users, connectionId);
}

function userState(awareness, currentUser) {
  if (!awareness) {
    return new Map([["local", {
      ...currentUser,
      avatarUrl: currentUser.avatar_url,
      colour: FALLBACK_COLOR,
      selection: null,
    }]]);
  }

  return new Map(Array.from(awareness.getStates(), ([clientId, state]) => {
    const user = state.user || {};
    return [clientId, {
      id: user.id,
      name: user.name || `Editor ${clientId}`,
      avatarUrl: user.avatarUrl || user.avatar_url || "",
      colour: user.color || FALLBACK_COLOR,
      selection: state.previewSelection || null,
      previewCursor: state.cursor || null,
    }];
  }));
}

export function setupUsers(container, currentUser, awareness) {
  const connectionId = awareness?.clientID ?? "local";
  const footnoteSidebar = document.querySelector("[data-footnote-sidebar]");
  let lastSelection = "";

  function renderLocations() {
    renderEditorLocations(userState(awareness, currentUser), connectionId);
  }

  function render() {
    renderUsers(container, userState(awareness, currentUser), connectionId);
  }

  awareness?.on("change", render);
  window.addEventListener("resize", renderLocations);
  footnoteSidebar?.addEventListener("scroll", renderLocations);
  render();

  return {
    renderLocations,
    sendSelection(selection) {
      const localSelection = awareness?.getLocalState()?.previewSelection;
      if (
        selection?.cursor === undefined
        && localSelection?.fieldName === selection?.fieldName
        && localSelection?.blockIndex === selection?.blockIndex
      ) return;

      const serialized = JSON.stringify(selection);
      if (serialized === lastSelection) return;

      lastSelection = serialized;
      if (selection?.previewCursor !== undefined) {
        awareness?.setLocalStateField("cursor", selection.previewCursor || null);
      } else if (selection?.kind || selection?.cursor === undefined) {
        awareness?.setLocalStateField("cursor", null);
      }
      awareness?.setLocalStateField("previewSelection", selection || null);
    },
    destroy() {
      awareness?.off("change", render);
      window.removeEventListener("resize", renderLocations);
      footnoteSidebar?.removeEventListener("scroll", renderLocations);
    },
  };
}
