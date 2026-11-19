# Chat with a WebSocket

The same chat as [chat-polling](../chat-polling/README.md), but every page
keeps one WebSocket connection open, and the server pushes each new message to
everybody the moment it arrives. Nothing is polled, so the server's terminal
stays quiet until somebody writes.

```
chat-websocket/
├── server.ts     Bun.serve: the page, the /ws upgrade, the websocket handlers (open, message, close)
└── index.html    the page: plain HTML and JavaScript, no build step
```

## Run it

```bash
cd week-05/demos
bun chat-websocket/server.ts    # or: bun run chat:websocket
```

Open http://localhost:3002 in two browser windows side by side. Stop the
server with Ctrl+C. The messages live in an array in memory and are gone
after a restart.

## What to show in class

1. **Open two windows.** The terminal says `a browser connected (1 connected)`,
   then `(2 connected)`, and then stays quiet. Compare with the polling chat's
   terminal, which keeps scrolling.
2. **Send a message.** It appears in both windows at the same moment, and the
   terminal logs one line: `new message #1 from Ada → pushed to 2 browsers`.
3. **DevTools → Network.** Filter to WebSocket connections (**Socket** or
   **WS**, depending on the browser) and click `ws`:
   - *Headers*: the request has `Upgrade: websocket`, and the answer is
     `101 Switching Protocols`. That is the only HTTP exchange.
   - *Messages*: every message on the connection, sent (↑) and received
     (↓), as JSON strings. Send a few messages and watch them appear.
4. **Open a third window.** The earlier messages appear in it at once: on
   connect, the server sends the history.
5. **Close a window**, then **stop the server.** The terminal says
   `a browser disconnected`, and the pages show *Disconnected* immediately.
   (The polling page only notices on its next request.) They don't reconnect
   by themselves; that is code you write.

To see the two transports side by side, diff the files. Only the parts that
receive and send messages differ:

```bash
diff chat-polling/index.html chat-websocket/index.html
diff chat-polling/server.ts chat-websocket/server.ts
```

## The protocol

| Step | Direction | What |
| ---- | --------- | ---- |
| Connect | browser → server | `GET /ws` with `Upgrade: websocket`; the answer is `101 Switching Protocols` (`426` for a plain GET) |
| History | server → browser | every earlier message, one WebSocket message each |
| Send | browser → server | `{ "name": "…", "text": "…" }` as a JSON string |
| New message | server → every browser | the stored message: `{ "id": 3, "name": "Ada", "text": "Hello!", "sentAt": "…" }` |

Messages that are not valid JSON, or have no `name` or `text`, are ignored.

Without the page, from the DevTools console of any tab:

```js
const ws = new WebSocket("ws://localhost:3002/ws");
ws.onmessage = (event) => console.log(event.data);
ws.onopen = () => ws.send(JSON.stringify({ name: "console", text: "hi from the console" }));
```

```bash
curl -i http://localhost:3002/ws      # 426: a plain GET is not an upgrade
```

## How it works

### The upgrade

```ts
"/ws": (req, server) => {
  if (server.upgrade(req)) return undefined;
  return new Response("Expected a WebSocket upgrade.", { status: 426 });
},
```

A WebSocket starts as an ordinary HTTP request. `server.upgrade(req)` checks
the `Upgrade: websocket` headers, answers `101 Switching Protocols` and hands
the connection over to the `websocket` handlers. Because Bun has already
answered, the handler returns `undefined` instead of a `Response`. A request
without the headers gets `426 Upgrade Required`.

### Three handlers for every connection

The `websocket` object passed to `Bun.serve`, without the logging:

```ts
websocket: {
  open(ws) {
    ws.subscribe("chat");                                         // join the topic
    for (const message of messages) ws.send(JSON.stringify(message)); // history for this browser
  },
  message(_ws, data) {
    const input = parseChatInput(parseJson(String(data)));
    if (!input) return;
    const message = { id: messages.length + 1, ...input, sentAt: new Date().toISOString() };
    messages.push(message);
    server.publish("chat", JSON.stringify(message));              // to every subscriber
  },
  close() {
    // Bun has already unsubscribed the socket from its topics.
  },
},
```

- **`ws` is one connection.** `ws.send()` sends to that browser only, which
  is how a new window gets the history.
- **Publish/subscribe.** A socket `subscribe`s to a topic, which is just a
  string. One `publish` reaches every socket in the topic, so there is no
  hand-written list of connections to loop over.
- **`server.publish` or `ws.publish`.** `server.publish("chat", …)` reaches
  everybody, the sender included, so the sender sees its own message come
  back from the server. `ws.publish("chat", …)` would reach everybody
  *except* that socket.
- **`server.subscriberCount("chat")`** says how many sockets are in a topic.
  A polling server cannot know who is online; a WebSocket server can.
- **`data` is a string or bytes.** Here it is JSON, so it is parsed and then
  checked like any request body. A WebSocket message is input from the
  network like any other.
- **Defaults worth knowing.** Bun closes a connection after 120 s without
  traffic (`idleTimeout`), sends pings to keep healthy connections open
  (`sendPings`), and rejects messages over 16 MB (`maxPayloadLength`). All of
  them can be set in the `websocket` object.

### The page

```js
const protocol = location.protocol === "https:" ? "wss" : "ws";
const socket = new WebSocket(`${protocol}://${location.host}/ws`);

socket.addEventListener("message", (event) => show(JSON.parse(event.data)));
socket.addEventListener("close", () => { status.textContent = "Disconnected. …"; });

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ name: nameInput.value, text: textInput.value }));
});
```

- `ws://` is the WebSocket version of `http://`, and `wss://` of
  `https://`. A page served over HTTPS must use `wss://`.
- There is no timer anywhere. The `message` event fires whenever the server
  sends something.
- Sending uses the same connection. `send()` throws while the socket is
  still connecting and silently drops data once it is closed, hence the
  `readyState` check.
- Messages are shown with `textContent`, never `innerHTML` (see the polling
  chat's README).

## Compared with the polling chat

| | Polling | WebSocket |
| - | - | - |
| Requests while nobody writes | One per window every 2 s | None |
| Delay of a new message | Up to 2 s | Immediate |
| Who can start a message | Only the browser | Either side, at any time |
| The server knows who is online | No | Yes (`subscriberCount`) |
| After a server restart | The next poll just works | The connection is gone; reconnecting is your code |
| Network requirements | Plain HTTP | The proxy must allow `Upgrade` (most do) |

## What a real chat would add

- **Reconnecting** after a closed connection, with growing waits (1 s, 2 s,
  4 s, …), and fetching the messages it missed while offline.
- **Checking `Origin`** before upgrading. Browsers let any page open a
  WebSocket to any server, and CORS doesn't apply. Then **authentication**
  (week 7): `server.upgrade(req, { data: { userId } })` attaches data that the
  handlers read as `ws.data`.
- **Limits**: a maximum message size and a rate limit per connection.
- **Storage**: messages in a database (week 6) instead of an array.
- **More than one server process**: `publish` only reaches the sockets of the
  process that calls it. Several instances need a message broker between them,
  such as Redis pub/sub or NATS.

## Try it yourself

1. Show "3 people online": publish the subscriber count to everybody in `open`
   and `close`, like the gallery's viewer count. You now have two kinds of
   messages: give each a `type` and handle them with a `switch`.
2. Add "Ada is typing…". What should the server do with a typing message? Who
   should receive it (`ws.publish` or `server.publish`)?
3. Reconnect when the connection closes, waiting 1 s, 2 s, 4 s, … between
   attempts. On reconnect the server sends the whole history again: how do you
   avoid showing messages twice?
4. Reject other origins: in `/ws`, answer `403` unless the `Origin` header is
   `http://localhost:3002`. Test it by opening a WebSocket from the console of
   a page on another port.
5. Send the history as one message (`{ type: "history", messages: [...] }`)
   instead of one message per stored message.

## Further reading

- [Bun: WebSockets](https://bun.sh/docs/api/websockets)
- [MDN: Writing WebSocket client applications](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications)
- [RFC 6455: The WebSocket Protocol](https://www.rfc-editor.org/rfc/rfc6455)
- [OWASP: WebSocket Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)
