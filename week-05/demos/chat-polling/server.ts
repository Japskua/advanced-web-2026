// Chat WITHOUT WebSockets: every browser asks "anything new?" every two seconds.
//
//   bun chat-polling/server.ts      →  http://localhost:3001 (open it in two windows)
//
// Watch this terminal: it fills up with requests even when nobody is typing.
// Compare with chat-websocket/server.ts, which does the same with a WebSocket.

type ChatMessage = { id: number; name: string; text: string; sentAt: string };

// The whole "database": an array in memory. It is empty again after a restart.
const messages: ChatMessage[] = [];
let pollCount = 0;

const server = Bun.serve({
  port: 3001,
  routes: {
    // The page: plain HTML with a <script>, no build step.
    "/": () => new Response(Bun.file(`${import.meta.dir}/index.html`)),

    "/api/messages": {
      // GET /api/messages?after=12 → the messages with an id greater than 12.
      // The browser remembers the newest id it has, so each poll returns only
      // what is new, and usually that is nothing at all.
      GET: (req) => {
        const after = Number(new URL(req.url).searchParams.get("after")) || 0;
        const newMessages = messages.filter((m) => m.id > after);
        pollCount++;
        console.log(`poll #${pollCount}: after=${after} → ${newMessages.length} new`);
        return Response.json(newMessages);
      },

      // POST /api/messages with { "name": "…", "text": "…" } stores a message.
      // Nobody is told about it: the other browsers find it on their next poll.
      POST: async (req) => {
        const input = parseChatInput(await req.json().catch(() => null));
        if (!input) return Response.json({ error: "Expected { name, text }." }, { status: 400 });

        const message: ChatMessage = { id: messages.length + 1, ...input, sentAt: new Date().toISOString() };
        messages.push(message);
        console.log(`new message #${message.id} from ${message.name}`);
        return Response.json(message, { status: 201 });
      },
    },
  },
});

console.log(`Polling chat at ${server.url}`);

// The same check as in chat-websocket/server.ts: never trust what a client sends.
function parseChatInput(value: unknown): { name: string; text: string } | null {
  if (typeof value !== "object" || value === null) return null;
  const { name, text } = value as Record<string, unknown>;
  if (typeof name !== "string" || typeof text !== "string") return null;
  if (!name.trim() || !text.trim()) return null;
  return { name: name.trim().slice(0, 20), text: text.trim().slice(0, 200) };
}
