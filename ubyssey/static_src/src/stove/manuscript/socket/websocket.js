const RECONNECT_DELAY = 1000;

function socketUrl(pageId) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/stove/manuscript/${pageId}/`;
}

export function connectWebSocket(pageId, { onMessage, onClose }) {
  let socket;
  let reconnectTimer;
  let closed = false;

  function connect() {
    socket = new WebSocket(socketUrl(pageId));

    socket.addEventListener("message", (event) => {
      try {
        onMessage(JSON.parse(event.data));
      } catch (error) {
        console.error("Invalid WebSocket message: ", error);
      }
    });

    socket.addEventListener("close", (event) => {
      onClose();
      if (!closed && event.code !== 4401) {
        reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY);
      }
    });
  }

  connect();

  return {
    send(message) {
      if (socket.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(message));
      return true;
    },

    close() {
      closed = true;
      window.clearTimeout(reconnectTimer);
      socket.close();
    },
  };
}
