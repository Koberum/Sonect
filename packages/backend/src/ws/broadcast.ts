import { WebSocketServer, WebSocket } from "ws";

let wss: WebSocketServer | null = null;

export function setWss(server: WebSocketServer) {
  wss = server;
}

export function broadcast(data: unknown) {
  if (!wss) return;
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
