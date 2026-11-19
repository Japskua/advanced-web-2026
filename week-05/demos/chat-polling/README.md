# Chat with polling (no WebSockets)

A chat in two files. The page asks the server for new messages every two
seconds, the way week 4's Joke Dashboard asked for a new joke. This is the
"before" picture for the [WebSocket chat](../chat-websocket/README.md): the
two have the same page and the same messages, and only how messages travel is
different.

```
chat-polling/
├── server.ts     Bun.serve: the page, GET and POST /api/messages, messages in an array
└── index.html    the page: plain HTML and JavaScript, no build step
```

## Run it

```bash
cd week-05/demos
bun chat-polling/server.ts      # or: bun run chat:polling
```

Open http://localhost:3001 in two browser windows side by side. Stop the
server with Ctrl+C. The messages live in an array in memory, so they are gone
after a restart: reload the pages too (see *Try it yourself*, item 4, for
why).

## What to show in class

1. **Leave it alone for ten seconds.** The terminal prints a line for every
   request, about one per second with two windows open, and nearly all of them
   say `→ 0 new`:

   ```
   poll #14: after=0 → 0 new
   poll #15: after=0 → 0 new
   new message #1 from Ada
   poll #16: after=0 → 1 new
   poll #17: after=0 → 1 new
   poll #18: after=1 → 0 new
   ```

   The status line above the messages counts the same thing in the page:
   *Requests so far: 15. Answered "nothing new": 15.*
2. **DevTools → Network.** A new `messages?after=…` request appears every two
   seconds. Click one: a full HTTP request and response, usually with `[]` as
   the body.
3. **Send a message.** The other window shows it up to two seconds later, and
   so does your own window, because the page shows only what a poll brings.
4. **Stop the server.** On its next poll the page says *The server is not
   answering*. It keeps trying, so it picks up again when the server is back.

## The API

| Method | Path | Body | Answer |
| ------ | ---- | ---- | ------ |
| `GET` | `/` | – | `200` the page (`index.html`) |
| `GET` | `/api/messages?after=<id>` | – | `200` the messages with an id greater than `<id>`, oldest first. Usually `[]` |
| `POST` | `/api/messages` | `{ "name": "…", "text": "…" }` | `201` the stored message; `400` if `name` or `text` is missing or empty |

A message looks like this. The server trims the name to 20 characters and
the text to 200:

```json
{ "id": 3, "name": "Ada", "text": "Hello!", "sentAt": "2026-11-23T08:15:00.000Z" }
```

With curl (the browser windows show the message on their next poll):

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"curl","text":"hello from the terminal"}' http://localhost:3001/api/messages
curl "http://localhost:3001/api/messages?after=0"
```

## How it works

### The page asks every two seconds

```js
let lastId = 0;

async function poll() {
  const res = await fetch(`/api/messages?after=${lastId}`);
  const messages = await res.json();
  for (const message of messages) {
    show(message);
    lastId = message.id;
  }
}

poll();                    // once right away,
setInterval(poll, 2000);   // then every two seconds
```

- **`after` is a cursor.** The page remembers the newest id it has shown and
  asks only for newer messages. Without it every poll would download the whole
  history again.
- **The interval is a trade-off.** Polling every second halves the delay and
  doubles the number of requests. No setting gives you both.
- **`setInterval` doesn't wait.** If one request takes longer than two
  seconds, the next one starts anyway. Scheduling the next poll with
  `setTimeout` *after* each answer avoids overlapping requests.

### Sending is an ordinary POST

```js
await fetch("/api/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: nameInput.value, text: textInput.value }),
});
```

The server stores the message and tells nobody about it. Every window,
including the sender's, finds it on its next poll.

### The server

```ts
GET: (req) => {
  const after = Number(new URL(req.url).searchParams.get("after")) || 0;
  return Response.json(messages.filter((m) => m.id > after));
},

POST: async (req) => {
  const input = parseChatInput(await req.json().catch(() => null));
  if (!input) return Response.json({ error: "Expected { name, text }." }, { status: 400 });
  const message = { id: messages.length + 1, ...input, sentAt: new Date().toISOString() };
  messages.push(message);
  return Response.json(message, { status: 201 });
},
```

- `Number(...) || 0` turns a missing or nonsense `after` (`null`, `"abc"`)
  into 0. Without `|| 0`, `"abc"` would become `NaN`, and since `m.id > NaN`
  is always false, the page would never get a message.
- `parseChatInput()` checks that the body is an object with two non-empty
  strings, and cuts them to length. The body comes from the network, so it is
  `unknown` until checked, as in every API of the course.

### The text is shown with `textContent`

```js
li.textContent = `${time}  ${message.name}: ${message.text}`;
```

The messages come from other people. With `innerHTML`, a message such as
`<img src=x onerror="…">` would run its script in every reader's browser:
cross-site scripting (week 11). With `textContent` it is just text. Send
`<b>hi</b>` and see it shown as is.

## What polling costs

| | One window | 100 windows |
| - | - | - |
| Requests per minute | 30 | 3,000 (50 per second) |
| Requests while nobody writes | All of them | All of them |
| Delay of a new message | 1 s on average, 2 s at most | the same |

Every poll is a complete HTTP request: request and response headers (a few
hundred bytes, more with cookies), a handler call and a response, even when
the answer is `[]`.

Polling is still a reasonable choice when updates are rare, when a delay of a
few seconds doesn't matter, or when the network allows nothing but plain HTTP.
It is simple, works through every proxy, and survives server restarts without
extra code.

## Between polling and a WebSocket

- **Long polling.** The server doesn't answer `GET /api/messages` until there
  is something new, or until a timeout (say 25 s) passes, and the page asks
  again straight after each answer. Messages arrive almost at once and there
  are far fewer empty answers, but every waiting page holds an open request on
  the server.
- **Server-Sent Events.** `new EventSource("/events")` keeps one HTTP response
  open, and the server writes events into it. It works only from the server to
  the browser; the browser still sends with `fetch`. It reconnects by itself.
- **WebSocket.** One connection, messages in both directions, at any time:
  [chat-websocket](../chat-websocket/README.md).

## Try it yourself

1. Show your own message at once: call `poll()` right after the POST. Can a
   message now appear twice? (Two polls may run at the same time with the same
   `lastId`.) Skip messages whose id is not greater than `lastId`.
2. Replace `setInterval` with a `setTimeout` that is scheduled after each
   answer, so polls never overlap.
3. Poll every 10 s while the tab is hidden and every 2 s when it is visible
   (`document.visibilityState` and the `visibilitychange` event).
4. Restart the server while a page is open, then send a message. The open page
   never shows it. Why? (Compare the new message's id with the page's
   `lastId`.) How could the server's ids avoid this?
5. Turn it into long polling: let the GET handler wait until a message arrives
   or 25 seconds pass. (Keep a list of waiting `resolve` functions and call
   them from the POST handler.)

## Further reading

- [MDN: Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [MDN: Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [OWASP: Cross-Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
