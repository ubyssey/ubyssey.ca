import { connectWebSocket } from "./websocket.js";

// Shows current active users on page
function renderUsers(container, users) {
  const avatars = Array.from(users.values(), (user) => {
    const image = document.createElement("img");
    image.className = "manuscript-connected-users__avatar";
    image.src = user.avatar_url;
    image.alt = user.name;
    image.title = `${user.name} is editing`;
    return image;
  });

  container.replaceChildren(...avatars);
}

export function setupUsers(pageId, container, currentUser) {
  const users = new Map();
  let connectionId;
  let websocket;

  function handleUserMessage(message) {
    if (message.type === "user.connected") {
      connectionId = message.connection_id;
      users.set(connectionId, currentUser);
      websocket.send({ type: "user.join", connection_id: connectionId, user: currentUser });
    }

    if (message.type === "user.join" || message.type === "user.here") {
      users.set(message.connection_id, message.user);
    }

    if (message.type === "user.join") {
      websocket.send({ type: "user.here", connection_id: connectionId, user: currentUser });
    }

    if (message.type === "user.leave") {
      users.delete(message.connection_id);
    }

    renderUsers(container, users);
  }

  websocket = connectWebSocket(pageId, {
    onMessage: handleUserMessage,
    onClose() {
      users.clear();
      renderUsers(container, users);
    },
  });

  return websocket;
}
