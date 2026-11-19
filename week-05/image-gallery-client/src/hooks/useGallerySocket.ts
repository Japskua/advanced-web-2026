import { useEffect, useEffectEvent, useState } from "react";
import type { ServerMessage } from "@shared/socket-messages";
import { WS_URL } from "../config";

export type SocketStatus = "connecting" | "open" | "closed";

/**
 * Keeps a WebSocket to the API open while the component is on the page and
 * calls `onMessage` for every message the server pushes. Returns the state of
 * the connection, for a "Live" indicator.
 *
 * The same effect pattern as week 4's fetch: start something in the effect,
 * stop it in the cleanup. Under StrictMode the effect runs twice on mount, so
 * the first socket is closed again right away (the browser may log "closed
 * before the connection is established"); the second one stays.
 */
export function useGallerySocket(onMessage: (message: ServerMessage) => void): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>("connecting");

  // useEffectEvent: a function the effect can call that always sees the latest
  // props and state, without being a dependency. Without it, the effect would
  // depend on onMessage (a new function on every render) and reconnect after
  // every render.
  const handleMessage = useEffectEvent(onMessage);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);

    socket.addEventListener("open", () => setStatus("open"));
    socket.addEventListener("close", () => setStatus("closed"));
    socket.addEventListener("message", (event: MessageEvent) => {
      // Never trust the network: a message that is not JSON is ignored.
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      handleMessage(message);
    });

    // Cleanup: close the connection when the component leaves the page.
    return () => socket.close();
  }, []);

  return status;
}
