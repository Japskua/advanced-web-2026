# Week 5 – Files, uploads, caching and real-time updates

This week builds an **Image Gallery**: users upload images from the browser,
the API stores the files on disk and keeps metadata about them in a JSON file,
and the client shows them in a grid. Every open tab is connected to the API over a
**WebSocket**, so the server can push news to the browser instead of waiting to
be asked.

The new back-end topics are working with the **file system**, receiving
**multipart/form-data**, checking uploaded files properly, **middleware** (a
request logger wrapped around every handler), **HTTP caching** (`ETag` and
`304 Not Modified`, `Range` and `206 Partial Content`) and **WebSockets** with
Bun's built-in publish/subscribe. The front-end adds file inputs, `FormData`
and a hook that keeps a WebSocket open.

## Learning objectives

After this week you can:

- receive file uploads with `req.formData()` and send them from the browser with `FormData`
- read and write files with `Bun.file` and `Bun.write`
- validate uploads: size limit, allowed types, and the actual file content ("magic bytes")
- serve user-uploaded files safely (`nosniff`, generated file names, no path traversal)
- write middleware as a higher-order function and apply it to every route
- explain why a JSON file is a poor database, which motivates week 6
- make files cacheable: `Cache-Control`, `ETag`, `If-None-Match` and `304 Not Modified`, and what `Range` requests are for
- push messages from the server with WebSockets: upgrade, `open`/`message`/`close`, topics with `subscribe` and `publish`
- keep a WebSocket open from React with an effect and close it in the cleanup

## What you build

| Method | Path | Body | Success | Errors |
| ------ | ---- | ---- | ------- | ------ |
| `GET` | `/api/uploads` | – | `200` `UploadRecord[]`, newest first | – |
| `POST` | `/api/uploads` | multipart, field `image` | `201` the `UploadRecord` | `400` no/empty file, `413` > 5 MB, `415` not a supported image |
| `GET` | `/uploads/:filename` | – | `200` the image bytes (`206` for a `Range`, `304` for a matching `If-None-Match`) | `400` invalid name, `404` unknown |
| `GET` | `/ws` | – | `101 Switching Protocols`: a WebSocket that receives `ServerMessage`s | `426` not a WebSocket upgrade |

On disk (both folders are git-ignored and created at startup):

```
image-gallery-api/
├── uploads/
│   └── 3f1c…e9.png          the image, renamed to <uuid>.<ext>
└── data/
    └── uploads.json         [{ id, filename, originalName, mimeType, size, uploadedAt, url }, …]
```

## Running it

```bash
# terminal 1
cd week-05/image-gallery-api
bun run dev            # http://localhost:8000 — watch the request log here
bun test               # 18 tests, run in a temporary folder

# terminal 2
cd week-05/image-gallery-client
bun run dev            # http://localhost:5173
```

**Class demos.** [`demos/`](demos/README.md) has three tiny stand-alone servers
(one or two files each) that show this week's two new ideas in isolation: a
chat that polls next to the same chat with a WebSocket, and the same JSON
served with and without an ETag. The README there says what to show.

## Project structure

```
week-05/
├── shared/
│   ├── types.ts                    UploadRecord, ApiResult<T>
│   ├── socket-messages.ts          ServerMessage: what the API pushes over the WebSocket
│   └── upload-rules.ts             MAX_UPLOAD_BYTES, ALLOWED_IMAGE_TYPES (values, used by both sides)
├── demos/                          stand-alone class demos, see demos/README.md
│   ├── chat-polling/               a chat without WebSockets: every browser asks every 2 s (port 3001)
│   ├── chat-websocket/             the same chat with a WebSocket: the server pushes (port 3002)
│   └── etag/                       the same JSON without and with an ETag (port 3003)
├── image-gallery-api/src/
│   ├── main.ts                     ensureStorage(), Bun.serve with middleware, a body size limit and websocket
│   ├── config.ts                   PORT, UPLOADS_DIR, DATA_DIR, MAX_REQUEST_BYTES
│   ├── router.ts                   the handlers (three HTTP routes + the /ws upgrade), routes, fallback
│   ├── realtime.ts                 websocket handlers (open/message/close), GALLERY_TOPIC, encode()
│   ├── middleware/
│   │   ├── middleware.ts           Handler/Middleware types, applyMiddleware()
│   │   └── logger.ts               withLogging
│   ├── services/
│   │   └── upload-service.ts       validation, file writing, JSON "database"
│   └── util/
│       ├── response.ts             ok(), fail(), corsHeaders() (moved out of the router)
│       └── http-cache.ts           etagMatches(), notModified()
└── image-gallery-client/src/
    ├── App.tsx                     state, initial load, upload flow
    ├── api.ts                      fetchUploads(), uploadImage(), imageUrl()
    ├── config.ts                   API_URL, WS_URL
    ├── hooks/useGallerySocket.ts   opens the WebSocket, calls back for every message, closes it in the cleanup
    ├── format.ts                   formatBytes(), formatDate()
    └── components/                 UploadForm, Gallery, StatusBanner
```

---

## Concepts: the back-end

### Files with Bun

| Task | Bun | Notes |
| ---- | --- | ----- |
| Refer to a file | `Bun.file(path)` | Lazy: nothing is read yet |
| Read | `await file.text()`, `.json()`, `.bytes()`, `.arrayBuffer()`, `.stream()` | |
| Check existence | `await file.exists()` | |
| Size and type | `file.size`, `file.type` | `type` is guessed from the extension |
| Write | `await Bun.write(path, data)` | `data` can be a string, bytes, a `Blob`, a `File` or a `Response`; creates missing folders |
| Send to the client | `new Response(Bun.file(path))` | Streams the file and sets `Content-Type` |
| Create a folder | `await mkdir(dir, { recursive: true })` | from `node:fs/promises`; Bun supports Node's built-in modules |

Writing an uploaded file is one line, because a `File` from `formData()` can be
passed straight to `Bun.write`:

```ts
await Bun.write(path.join(UPLOADS_DIR, filename), file);
```

Paths are built with `path.join`/`path.resolve` from `node:path`, never by
gluing strings, and they start from `import.meta.dir` (see `config.ts`), so the
server works from any working directory.

### multipart/form-data

JSON cannot carry binary files efficiently. HTML forms and the `FormData` API
send files as **multipart/form-data**: the body is split into parts separated by
a random *boundary* string, and each part has its own headers:

```
POST /api/uploads
Content-Type: multipart/form-data; boundary=----bun7f3a

------bun7f3a
Content-Disposition: form-data; name="image"; filename="cat.png"
Content-Type: image/png

<binary PNG data>
------bun7f3a--
```

On the server, `req.formData()` parses this. File fields come back as `File`
objects:

```ts
const form = await req.formData().catch(() => null);   // throws if the body is not form data
if (!form) return fail("Expected a multipart/form-data body with an 'image' field.", 400);

const image = form.get("image");                         // File | string | null
if (!(image instanceof File)) return fail("Missing file field 'image'.", 400);
```

In the browser, the client builds the body with `FormData` and **does not** set
`Content-Type` itself; `fetch` adds it together with the boundary:

```ts
const form = new FormData();
form.append("image", file);
await fetch(`${API_URL}/api/uploads`, { method: "POST", body: form });
```

### Validating uploads

`saveUploadedImage()` checks, in order:

| Check | Why | Status |
| ----- | --- | ------ |
| Not empty | Nothing to store | `400 Bad Request` |
| ≤ 5 MB | Disk space, memory, abuse | `413 Content Too Large` |
| `file.type` is PNG/JPEG/WebP/GIF | Only images belong in an image gallery | `415 Unsupported Media Type` |
| The first bytes match that type | `file.type` is just what the client *claimed* | `415` |

The last check matters. Anyone can upload an HTML file containing JavaScript
and label it `image/png`. Image formats begin with a fixed signature (PNG files
start with the bytes `89 50 4E 47 0D 0A 1A 0A`, JPEGs with `FF D8 FF`, …), so
`detectImageType()` looks at the first 12 bytes and compares them with the claimed
type.

There are two more layers:

- `Bun.serve({ maxRequestBodySize })` rejects oversized bodies before any of
  our code runs, so a 2 GB upload never fills the server's memory.
- The client checks type and size first for instant feedback, using the
  **same constants** from `shared/upload-rules.ts`. Unlike `types.ts`, that file
  contains values, so it really is bundled into both programs.

### Serving uploaded files safely

```ts
const filePath = resolveUploadPath(req.params.filename);   // null unless "<uuid>.<png|jpg|webp|gif>"
if (!filePath) return fail("Invalid file name.", 400);

return new Response(Bun.file(filePath), {
  headers: { ...caching, "X-Content-Type-Options": "nosniff" },   // caching: see "HTTP caching" below
});
```

- Files are stored under a **generated name** (`<uuid>.<ext>`), never the
  user's file name. User-supplied names can contain `../`, collide with other
  uploads, or be absurdly long. The original name is kept as metadata only.
- Only names matching that pattern are served, which also rules out path
  traversal.
- `X-Content-Type-Options: nosniff` stops browsers from second-guessing the
  `Content-Type`, so an upload can never be treated as a page or a script.
- Since a file name never changes content, the browser may cache it for a year
  (`immutable`). The next section explains the caching headers.

### HTTP caching: Cache-Control, ETag and 304

Downloading the same image again on every visit wastes bandwidth and time. HTTP
lets the server tell the browser **how long** it may reuse a response and **how
to check** whether a copy is still current.

| Header | Sent by | Meaning |
| ------ | ------- | ------- |
| `Cache-Control: public, max-age=31536000, immutable` | server | Reuse it for a year without asking. Right for content that never changes under the same URL, like our `<uuid>.png` files. |
| `Cache-Control: no-cache` | server | Keep it, but ask before every reuse. Right for data that changes, like a JSON list. (`no-store` is the one that forbids caching.) |
| `ETag: "44-19a8f3c2b10"` | server | A validator: a label for this exact version of the content. |
| `If-None-Match: "44-19a8f3c2b10"` | browser | "I have this version. Send it only if it changed." |
| `304 Not Modified` | server | "Your copy is current." No body, so nothing is downloaded again. |

The image route builds its ETag from the file's size and modification time
(like nginx), and compares it with the request's `If-None-Match` using the
helper in `util/http-cache.ts`:

```ts
const caching = {
  "Cache-Control": "public, max-age=31536000, immutable",
  ETag: `"${file.size.toString(16)}-${file.lastModified.toString(16)}"`,
};
if (etagMatches(req, caching.ETag)) return notModified(caching);   // 304, no body
```

`If-None-Match` can hold a list (`"a", "b"`) or `*`, and a tag may be *weak*
(`W/"a"`: "equivalent content", for example the same JSON with other white
space). `etagMatches()` handles all three. The browser adds `If-None-Match`
**by itself** when it has a cached response with an ETag; the React code does
not change at all. Try it: reload the page and look at the Network tab, where
cached images show `304` (or "memory cache" when `immutable` lets the browser
skip the request entirely).

```bash
curl -i http://localhost:8000/uploads/<filename>                                    # 200 with an ETag
curl -i -H 'If-None-Match: "<the etag>"' http://localhost:8000/uploads/<filename>   # 304, no body
```

### Range requests: 206 Partial Content

A video player that jumps to minute 40, or a download that resumes after a
broken connection, needs only **part** of a file:

```
GET /uploads/3f1c…e9.png
Range: bytes=0-7

HTTP/1.1 206 Partial Content
Content-Range: bytes 0-7/68
```

When a handler returns `new Response(Bun.file(path))`, **Bun answers `Range`
requests by itself**: `206` with the requested bytes and `Content-Range`. That is
one more reason to return a `Bun.file` instead of reading the file into memory
first. Try it with `curl -i -H "Range: bytes=0-7" http://localhost:8000/uploads/<filename>`.

### The JSON file "database" and its limits

Metadata is appended to `data/uploads.json` with a read-modify-write cycle:

```ts
const records = await readDb();   // 1. read the whole file
records.push(record);             // 2. change it in memory
await writeDb(records);           // 3. write the whole file back
```

This is fine for a demo, and it shows why real applications use databases:

- **Lost updates.** Two uploads finishing at the same time both read the same
  old list; the second write overwrites the first one's record.
- **Cost.** Every upload rewrites the whole file, and every list request reads
  and parses all of it.
- **No queries.** Filtering or paging means loading everything first.
- **Crashes.** A crash in the middle of a write can leave a broken file.

Week 6 moves the metadata to PostgreSQL and keeps the files on disk.

### Middleware

A **middleware** is a function that takes a handler and returns a new handler
with the same signature, which does something before and/or after calling the
original:

```ts
export const withLogging: Middleware = (next) => async (req, server) => {
  const start = performance.now();
  console.log(`→ ${req.method} ${pathname}`);

  const res = await next(req, server);                 // the wrapped handler

  console.log(`← ${res.status} ${req.method} ${pathname} (${ms} ms)`);
  return res;
};
```

Because the result is again a handler, middleware composes:
`withAuth(withLogging(handler))`. This is the central idea of Express, Koa and
Hono. In week 8 the course moves to Elysia, whose lifecycle hooks and macros do
the same job.

`Bun.serve` has no middleware system of its own. `applyMiddleware()` walks the
routes table and wraps every handler:

```ts
Bun.serve({
  routes: applyMiddleware(routes, withLogging),   // every route handler
  fetch: withLogging(fallback),                   // and the fallback
});
```

The `Handler` and `Middleware` types are **generic** over the request type, so
wrapping a handler for `/uploads/:filename` keeps its typed `req.params`.

> **Middleware in last year's version** wrapped the single router function:
> `(req) => withLogging(router)(req)`. With Bun's route table there is no single
> function to wrap, hence `applyMiddleware()`. The concept is identical.

### Real-time updates with WebSockets

Week 4's Joke Dashboard **polled**: it asked the API for a new joke every ten
seconds, whether anything had changed or not. For "tell me when something
happens" that is slow (up to ten seconds late) and wasteful (most answers are
"nothing new"). A **WebSocket** turns it around: the connection stays open and
the server sends a message the moment something happens.

| | Polling (week 4) | WebSocket |
| - | - | - |
| Who starts each message | The client, on a timer | Either side, at any time |
| Delay | Up to the polling interval | Immediately |
| Cost when nothing happens | A request + response every interval | Nothing (Bun sends a small ping now and then) |
| Connection | A new HTTP request each time | One TCP connection, kept open |

A WebSocket begins as an ordinary HTTP request with `Upgrade: websocket`. If
the server agrees, it answers `101 Switching Protocols`, and from then on the
same connection carries messages in both directions. The URL scheme is `ws://`
(`wss://` with TLS).

**On the server**, Bun has WebSockets built in. The route handler upgrades the
request, and the `websocket` object given to `Bun.serve` handles every
connection (`realtime.ts`):

```ts
// router.ts
"/ws": {
  GET: (req, server) => {
    if (server.upgrade(req)) return undefined;   // Bun answers 101; no Response to return
    return fail("Expected a WebSocket upgrade request.", 426);
  },
},

// realtime.ts
export const websocket: WebSocketHandler<undefined> = {
  open(ws) {
    viewers++;
    ws.subscribe(GALLERY_TOPIC);                          // join the "gallery" topic
    const message = encode({ type: "viewers", count: viewers });
    ws.send(message);                                     // to this tab
    ws.publish(GALLERY_TOPIC, message);                   // to every OTHER tab in the topic
  },
  message() {},                                           // our clients send nothing
  close(ws) {
    viewers--;
    ws.publish(GALLERY_TOPIC, encode({ type: "viewers", count: viewers }));
  },
};
```

- **Publish/subscribe.** A socket `subscribe`s to a topic (a string). One
  `publish` delivers a message to every subscriber, without a hand-written loop
  over the sockets. `ws.publish()` skips the sender; `server.publish()` (the
  `server` every handler receives as its second argument) reaches everyone.
- **Messages are strings.** Ours are JSON, typed by the `ServerMessage`
  discriminated union in `shared/socket-messages.ts`, so the server and the
  client agree on them like they agree on `UploadRecord`.
- **Middleware and upgrades.** After `server.upgrade()` there is no `Response`.
  The `Handler` type therefore allows `undefined`, and `withLogging` logs it as
  `101 (WebSocket)` instead of reading `res.status`. Every middleware has to
  check for this.
- **Not covered by CORS.** Browsers let any page open a WebSocket to any
  server. A real application checks the request's `Origin` header before
  upgrading and authenticates the user (weeks 7 and 11).
- **State lives in one process.** `viewers` is a variable in memory. Two API
  instances behind a load balancer would each count only their own tabs, and a
  `publish` would only reach the sockets of the instance that sent it. Larger
  systems put a message broker (Redis pub/sub, NATS) between the instances.

Try it without the client: open the browser's DevTools console on any page and
run `new WebSocket("ws://localhost:8000/ws").onmessage = (e) => console.log(e.data)`.
Open a second tab and watch the count change.

## Concepts: the front-end

Nothing fundamentally new; the week 4 patterns applied to files:

- **File inputs cannot be controlled.** For security, JavaScript cannot set a
  file input's value. The selected `File` is kept in state from `onChange`, and
  after a successful upload the form is cleared with `form.reset()`.
- **`e.currentTarget` after `await`.** React clears `currentTarget` once the
  event handler's synchronous part has finished, so the form element is saved
  in a variable *before* awaiting the upload.
- **Adding the server's response to state.** After an upload, the returned
  `UploadRecord` is prepended to the list instead of re-fetching everything.
- `<img loading="lazy">` lets the browser load images only when they scroll
  into view.

### A WebSocket in React: useGallerySocket

A WebSocket is a connection that must be closed again, like week 4's polling
timer, so it lives in an effect with a cleanup (`hooks/useGallerySocket.ts`):

```ts
export function useGallerySocket(onMessage: (message: ServerMessage) => void): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const handleMessage = useEffectEvent(onMessage);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    socket.addEventListener("open", () => setStatus("open"));
    socket.addEventListener("close", () => setStatus("closed"));
    socket.addEventListener("message", (event: MessageEvent) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;                                   // not JSON: ignore it
      }
      handleMessage(message);
    });
    return () => socket.close();                  // leave the page: close the connection
  }, []);

  return status;
}
```

- **One connection per mounted component.** The dependency array is empty, so
  the socket opens once. Under `StrictMode` the effect runs twice on mount: the
  first socket is closed by the cleanup right away (the console may say
  *"closed before the connection is established"*), and the second one stays.
- **`useEffectEvent`** (React 19.2+) wraps the callback so the effect always
  calls the newest version of it without listing it as a dependency. With
  `onMessage` in the dependency array, every render would close the socket and
  open a new one.
- **Narrowing the message.** `App` handles messages with
  `switch (message.type)`. Inside `case "viewers":` TypeScript knows that
  `message.count` exists.
- **Reconnecting.** If the API restarts, the socket closes and the indicator
  says *Offline*. A production app reconnects after a delay that grows with
  every failed attempt (exponential backoff), and re-fetches the list once
  connected, because messages sent while it was offline are lost.

## Lecture walkthrough

**Back-end**

1. Write `shared/types.ts` and `shared/upload-rules.ts`.
2. `config.ts`: paths relative to the project, the body size limit.
3. `upload-service.ts`: `ensureStorage`, `readDb`/`writeDb`, `listUploads`,
   then `saveUploadedImage` with all four checks. Show `detectImageType`
   rejecting an HTML file renamed to `.png`.
4. Move `ok`/`fail`/`corsHeaders` to `util/response.ts`.
5. `router.ts`: the three handlers. Test with curl:

   ```bash
   curl -F "image=@path/to/cat.png" http://localhost:8000/api/uploads
   curl http://localhost:8000/api/uploads
   ```

   `-F` makes curl send multipart/form-data. Open the returned `url` in the
   browser. Look inside `uploads/` and `data/uploads.json`.
6. `middleware/`: write `withLogging` for one handler first, then
   `applyMiddleware` for the whole table. Watch the log while using the app.
7. Caching: start with the ETag demo (`demos/etag`): the same JSON without
   and with an ETag in the Network tab. Then add `Cache-Control` and the ETag
   to the image route, then `etagMatches()`. Show `200`, then `304` with curl
   and in the Network tab (reload). Show that `Range` gives `206` without any
   code of ours.
8. Run the two chat demos (`demos/chat-polling`, `demos/chat-websocket`) side
   by side: the polling terminal fills up with empty answers, the WebSocket one
   stays quiet until somebody writes. Then `realtime.ts` and the `/ws` route;
   add `websocket` to `Bun.serve`. Connect from the DevTools console in two
   tabs and watch the viewer count. Show why `withLogging` needs the
   `undefined` check.

**Front-end**

9. `api.ts`: `uploadImage` with `FormData`, `imageUrl()`.
10. `UploadForm`, `Gallery`, `StatusBanner`, then `App`.
11. Try uploading a text file, a large file, and an image renamed from `.txt`.
12. `useGallerySocket` and the *Live* indicator. Open two tabs, close one, then
    stop the API and watch the indicator turn to *Offline*.

## Compared with last year's Deno version

- `Bun.write`/`Bun.file` instead of `Deno.writeFile`/`Deno.readFile`; no
  hand-written MIME-type table, no `--allow-read`/`--allow-write`.
- New: size limit (`413`), type allowlist (`415`), magic-byte check, `nosniff`
  and caching headers, `maxRequestBodySize`, shared validation rules.
- Error responses use the `{ ok: false, error: { message } }` envelope the
  client expects (last year they were plain strings and showed as `undefined`).
- Middleware is applied to the whole routes table with `applyMiddleware()`.
- New: `ETag`/`304` for the images, `Range`/`206` from `Bun.file`, and a
  WebSocket with publish/subscribe for live updates (last year had no real-time
  part).

## Exercises

The graded exercise (CodeGrade) is described on Moodle. Practice ideas:

1. Give `GET /api/uploads` an ETag and `Cache-Control: no-cache`, and answer
   `304` when nothing has changed. Unlike an image, the list changes with every
   upload: how do you make the ETag change too?
2. Serialise writes to `uploads.json` so concurrent uploads cannot lose
   records: keep a module-level `let queue = Promise.resolve()` and chain each
   read-modify-write onto it. Write a test that uploads ten files with
   `Promise.all` and checks that all ten records exist (it fails without the
   queue).
3. Write a `withTiming` middleware that adds a `Server-Timing` header to every
   response. Apply both middlewares and decide the order. What must it do after
   a WebSocket upgrade?
4. Publish a message to every open tab when an image is uploaded, and show the
   new image in the other tabs without reloading. What happens in the tab that
   uploaded it?
5. Show a preview of the selected image before uploading.
   `URL.createObjectURL(file)` creates a temporary URL for a `File`; release it
   with `URL.revokeObjectURL` in an effect's cleanup. Check that it works under
   `StrictMode`.
6. Reconnect `useGallerySocket` after the API restarts, waiting 1 s, 2 s, 4 s, …
   between attempts.

## Further reading

- [Bun: File I/O](https://bun.sh/docs/runtime/file-io)
- [MDN: Using FormData objects](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest_API/Using_FormData_Objects)
- [Wikipedia: List of file signatures (magic numbers)](https://en.wikipedia.org/wiki/List_of_file_signatures)
- [OWASP: File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [MDN: HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
- [MDN: HTTP range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests)
- [Bun: WebSockets](https://bun.sh/docs/api/websockets)
- [MDN: The WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [React: useEffectEvent](https://react.dev/reference/react/useEffectEvent)
