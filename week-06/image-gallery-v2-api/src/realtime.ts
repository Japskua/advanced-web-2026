/**
 * Real-time updates over WebSockets.
 *
 * HTTP is request-response: the server can only answer. A WebSocket starts as
 * an HTTP request (GET /ws with "Upgrade: websocket"), and if the server
 * agrees (101 Switching Protocols) the same TCP connection stays open in both
 * directions. The server can then push messages whenever something happens.
 *
 * Bun has WebSockets built in: the route handler calls server.upgrade(req),
 * and the `websocket` handlers below (passed to Bun.serve) run for every
 * connection. Bun also has publish/subscribe built in: a socket subscribes to
 * a topic, and one publish() reaches every subscriber of it.
 */
import type { WebSocketHandler } from "bun";
import type { ServerMessage } from "@shared/socket-messages";

// Every open gallery tab subscribes to this topic.
export const GALLERY_TOPIC = "gallery";

// WebSocket messages are strings (or binary). Ours are JSON, typed by the
// ServerMessage union in shared/.
export function encode(message: ServerMessage): string {
  return JSON.stringify(message);
}

// Number of open connections. Kept in memory, so it is per server process:
// with three API instances behind a load balancer, each would count only its
// own tabs (week 11 comes back to state shared between instances).
let viewers = 0;

export const websocket: WebSocketHandler<undefined> = {
  open(ws) {
    viewers++;
    ws.subscribe(GALLERY_TOPIC);
    const message = encode({ type: "viewers", count: viewers });
    ws.send(message); // to the new tab itself
    ws.publish(GALLERY_TOPIC, message); // to every OTHER subscriber
  },

  // The clients do not send anything yet. Bun requires the handler anyway.
  message() {},

  close(ws) {
    viewers--;
    // Bun has already unsubscribed the closed socket; the others hear about it.
    ws.publish(GALLERY_TOPIC, encode({ type: "viewers", count: viewers }));
  },
};
