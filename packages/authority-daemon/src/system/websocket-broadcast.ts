import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { AuthorityEvent } from "../../../../src/infrastructure/authority/contract";

export function createAuthorityWebsocketBroadcast() {
  const sockets = new Set<WebSocket>();
  const wsServer = new WebSocketServer({ noServer: true });

  wsServer.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => {
      sockets.delete(socket);
    });
  });

  function broadcast(event: AuthorityEvent) {
    const encoded = JSON.stringify(event);
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(encoded);
      }
    }
  }

  function attach(server: Server) {
    server.on("upgrade", (request, socket, head) => {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
      if (url.pathname !== "/events") {
        socket.destroy();
        return;
      }
      wsServer.handleUpgrade(request, socket, head, (websocket) => {
        wsServer.emit("connection", websocket, request);
      });
    });
  }

  return {
    broadcast,
    attach,
  };
}
