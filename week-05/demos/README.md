# Week 5 – class demos

Three tiny servers for the lecture. Each is one or two files with no
dependencies and no build step, and each shows one idea of the week without
the rest of the Image Gallery around it. Every demo has its own README: what
to show in class, how the code works, and exercises.

| Demo | Files | URL | Shows |
| ---- | ----- | --- | ----- |
| [chat-polling](chat-polling/README.md) | `server.ts`, `index.html` | http://localhost:3001 | A chat **without** WebSockets: every page asks for news every 2 s |
| [chat-websocket](chat-websocket/README.md) | `server.ts`, `index.html` | http://localhost:3002 | The same chat **with** a WebSocket: the server pushes each message |
| [etag](etag/README.md) | `server.ts` | http://localhost:3003 | The same JSON **without** and **with** an ETag: `200` every time vs `304` |

## Running them

You need only Bun. Start each demo from this folder in its own terminal, so
its log stays visible next to the browser:

```bash
cd week-05/demos
bun chat-polling/server.ts      # or: bun run chat:polling
bun chat-websocket/server.ts    # or: bun run chat:websocket
bun etag/server.ts              # or: bun run etag
```

The ports (3001–3003) are fixed in each `server.ts` and don't clash with the
gallery (8000 and 5173), so all three can run alongside it. Stop a demo with
Ctrl+C. The chats keep their messages in memory: after a restart, reload the
pages.

`bun run typecheck` checks the three servers. The pages are plain JavaScript
inside `<script>` tags.

## Where they fit in the lecture

| Lecture step (week README) | Demo | The point |
| -------------------------- | ---- | --------- |
| 7. Caching | [etag](etag/README.md) | `no-cache` alone means downloading everything again. An ETag turns the check into a `304` without a body, and the browser adds `If-None-Match` by itself. |
| 8. Real-time updates | [chat-polling](chat-polling/README.md), then [chat-websocket](chat-websocket/README.md), side by side | Polling asks all the time and is still up to 2 s late. A WebSocket is quiet until there is news, then immediate. |

After each demo, the lecture continues with the same idea in the Image
Gallery: `etagMatches()` on the image route, and `realtime.ts` with the
viewer count.

The two chats have the same page and the same message format, so a diff shows
exactly what switching to a WebSocket changes:

```bash
diff chat-polling/index.html chat-websocket/index.html
diff chat-polling/server.ts chat-websocket/server.ts
```

## What the demos leave out

They are deliberately minimal. None of them has authentication, an `Origin`
check, rate limiting, persistent storage or reconnect logic. Each README
lists what a real application would add, and the Image Gallery and later weeks
show how.
