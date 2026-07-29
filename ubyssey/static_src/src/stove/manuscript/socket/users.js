import { findArticleBlock } from "../blocks/operations.js";
import { manuscriptSession } from "../session.js";
import { connectWebSocket } from "./websocket.js";

// Generate based on ID
function colourForUser(user) {
  return `hsl(${(Number(user.id) * 137.5) % 360} 70% 40%)`;
}

// Look through various editors and find and show cursor/highlighted text
function renderCursor(root, user, block) {
  if (!Number.isInteger(user.selection.cursor)) return;

  const editorElements = [block, ...block.querySelectorAll(".ProseMirror")]
    .filter((element) => element.matches(".ProseMirror"));
  const editorElement = editorElements[user.selection.editorIndex];
  const view = [
    ...manuscriptSession.articleRichTextEditors,
    ...manuscriptSession.articleDirectTextEditors,
  ].find((editor) => editor.view.dom === editorElement)?.view;
  const container = root.querySelector(".article-shadow-preview");
  if (!view || !container) return;

  const documentSize = view.state.doc.content.size;
  const position = Math.max(0, Math.min(user.selection.cursor, documentSize));
  const coordinates = view.coordsAtPos(position);
  const containerRect = container.getBoundingClientRect();

  if (user.selection.from !== user.selection.to) {
    const from = Math.max(0, Math.min(user.selection.from, documentSize));
    const to = Math.max(from, Math.min(user.selection.to, documentSize));
    const start = view.domAtPos(from);
    const end = view.domAtPos(to);
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);

    const rectangles = Array.from(range.getClientRects());
    if (!rectangles.length) rectangles.push(range.getBoundingClientRect());

    for (const rectangle of rectangles) {
      const highlight = document.createElement("span");
      highlight.className = "pm-remote-selection";
      highlight.style.backgroundColor = user.colour;
      highlight.style.left = `${rectangle.left - containerRect.left + container.scrollLeft}px`;
      highlight.style.top = `${rectangle.top - containerRect.top + container.scrollTop}px`;
      highlight.style.width = `${Math.max(rectangle.width, 2)}px`;
      highlight.style.height = `${Math.max(rectangle.height, 16)}px`;
      container.appendChild(highlight);
    }
  }

  const cursor = document.createElement("span");
  cursor.className = "pm-remote-cursor";
  cursor.title = user.name;
  cursor.style.backgroundColor = user.colour;
  cursor.style.left = `${coordinates.left - containerRect.left + container.scrollLeft}px`;
  cursor.style.top = `${coordinates.top - containerRect.top + container.scrollTop}px`;
  cursor.style.height = `${Math.max(coordinates.bottom - coordinates.top, 16)}px`;
  container.appendChild(cursor);
}

// Render outline on current block (thinking about removing this)
function renderEditorLocations(users, connectionId) {
  const root = document.querySelector("[data-article-shadow]")?.shadowRoot;
  if (!root) return;

  root.querySelectorAll(".pm-article-block--remote-selected").forEach((block) => {
    block.classList.remove("pm-article-block--remote-selected");
    block.style.removeProperty("--remote-editor-color");
  });
  root.querySelectorAll(".pm-remote-cursor, .pm-remote-selection").forEach((marker) => { marker.remove(); });

  for (const [id, user] of users) {
    if (id === connectionId || !user.selection) continue;
    const block = findArticleBlock(root, user.selection);
    if (!block) continue;

    block.classList.add("pm-article-block--remote-selected");
    block.style.setProperty("--remote-editor-color", user.colour);
    renderCursor(root, user, block);
  }
}

function renderUsers(container, users, connectionId) {
  const avatars = Array.from(users.values(), (user) => {
    const image = document.createElement("img");
    image.className = "manuscript-connected-users__avatar";
    image.src = user.avatar_url;
    image.alt = user.name;
    image.title = `${user.name} is editing`;
    image.style.borderColor = user.colour;
    return image;
  });

  container.replaceChildren(...avatars);

  const root = document.querySelector("[data-article-shadow]")?.shadowRoot;
  const localUser = users.get(connectionId);
  root?.host.style.setProperty("--current-editor-color", localUser?.colour || "#f28c00");
  renderEditorLocations(users, connectionId);
}

export function setupUsers(pageId, container, currentUser) {
  const users = new Map();
  const localUser = { ...currentUser, colour: colourForUser(currentUser), selection: null };
  let connectionId;
  let websocket;
  let lastSelection = "";

  function renderLocations() {
    renderEditorLocations(users, connectionId);
  }

  function render() {
    renderUsers(container, users, connectionId);
  }

  function handleUserMessage(message) {
    switch (message.type) {
      case "user.connected":
        connectionId = message.connection_id;
        users.set(connectionId, localUser);
        websocket.send({ type: "user.join", connection_id: connectionId, user: localUser });
        break;
      case "user.join":
        users.set(message.connection_id, message.user);
        websocket.send({ type: "user.here", connection_id: connectionId, user: localUser });
        break;
      case "user.here":
        users.set(message.connection_id, message.user);
        break;
      case "user.selection": {
        const remoteUser = users.get(message.connection_id);
        if (remoteUser) {
          users.set(message.connection_id, { ...remoteUser, selection: message.selection });
        }
        break;
      }
      case "user.leave":
        users.delete(message.connection_id);
        break;
      default:
        return;
    }

    render();
  }

  websocket = connectWebSocket(pageId, {
    onMessage: handleUserMessage,
    onClose() {
      users.clear();
      render();
    },
  });

  window.addEventListener("resize", renderLocations);

  return {
    renderLocations,
    sendSelection(selection) {
      if (
        selection?.cursor === undefined
        && localUser.selection?.fieldName === selection?.fieldName
        && localUser.selection?.blockIndex === selection?.blockIndex
      ) return;

      const serialized = JSON.stringify(selection);
      if (!connectionId || serialized === lastSelection) return;

      lastSelection = serialized;
      localUser.selection = selection;
      websocket.send({ type: "user.selection", connection_id: connectionId, selection });
    },
  };
}
