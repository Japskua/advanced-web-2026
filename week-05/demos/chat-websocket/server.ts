// Chat WITH a WebSocket: every browser keeps one connection open, and the
// server pushes each new message to everybody the moment it arrives.
//
//   bun chat-websocket/server.ts    →  http://localhost:3002 (open it in two windows)
//
// Watch this terminal: it stays quiet until somebody actually sends something.
// Compare with chat-polling/server.ts, which does the same without a WebSocket.

type ChatMessage = { id: number; name: string; text: string; sentAt: string };

// The whole "database": an array in memory. It is empty again after a restart.
const messages: ChatMessage[] = [];

const server = Bun.serve({
  port: 3002,
  routes: {
    // The page: plain HTML with a <script>, no build step.
    "/": () => new Response(Bun.file(`${import.meta.dir}/index.html`)),

    // The page opens ws://localhost:3002/ws. That starts as an ordinary GET with
    // the header "Upgrade: websocket". server.upgrade() answers
    // "101 Switching Protocols", and from then on the connection belongs to the
    // `websocket` handlers below, so there is no Response to return.
    "/ws": (req, server) => {
      if (server.upgrade(req)) return undefined;
      return new Response("Expected a WebSocket upgrade.", { status: 426 });
    },
  },

  websocket: {
    // A browser connected.
    open(ws) {
      ws.subscribe("chat"); // join the topic "chat"
      for (const message of messages) ws.send(JSON.stringify(message)); // catch up on history
      console.log(`a browser connected (${server.subscriberCount("chat")} connected)`);
    },

    // A browser sent { "name": "…", "text": "…" } over its connection.
    message(_ws, data) {
      const input = parseChatInput(parseJson(String(data)));
      if (!input) return; // ignore anything that is not a valid chat message

      const message: ChatMessage = { id: messages.length + 1, ...input, sentAt: new Date().toISOString() };
      messages.push(message);
      // One call sends it to every socket subscribed to "chat", the sender
      // included. (ws.publish() would send to everybody except the sender.)
      server.publish("chat", JSON.stringify(message));
      console.log(`new message #${message.id} from ${message.name} → pushed to ${server.subscriberCount("chat")} browsers`);
    },

    // A browser closed the tab (Bun unsubscribes the socket by itself).
    close() {
      console.log(`a browser disconnected (${server.subscriberCount("chat")} connected)`);
    },
  },
});

console.log(`WebSocket chat at ${server.url}`);

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// The same check as in chat-polling/server.ts: never trust what a client sends.
function parseChatInput(value: unknown): { name: string; text: string } | null {
  if (typeof value !== "object" || value === null) return null;
  const { name, text } = value as Record<string, unknown>;
  if (typeof name !== "string" || typeof text !== "string") return null;
  if (!name.trim() || !text.trim()) return null;
  return { name: name.trim().slice(0, 20), text: text.trim().slice(0, 200) };
}
