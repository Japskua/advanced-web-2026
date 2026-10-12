# Week 5 – File system, multipart uploads and middleware

This week builds an **Image Gallery**: users upload images from the browser,
the API stores the files on disk and keeps metadata about them in a JSON file,
and the client shows them in a grid.

The new back-end topics are working with the **file system**, receiving
**multipart/form-data**, checking uploaded files properly, and **middleware**
(a request logger wrapped around every handler). The front-end reuses the
patterns from week 4 and adds file inputs and `FormData`.

## Learning objectives

After this week you can:

- receive file uploads with `req.formData()` and send them from the browser with `FormData`
- read and write files with `Bun.file` and `Bun.write`
- validate uploads: size limit, allowed types, and the actual file content ("magic bytes")
- serve user-uploaded files safely (`nosniff`, generated file names, no path traversal)
- write middleware as a higher-order function and apply it to every route
- explain why a JSON file is a poor database, which motivates week 6

## What you build

| Method | Path | Body | Success | Errors |
| ------ | ---- | ---- | ------- | ------ |
| `GET` | `/api/uploads` | – | `200` `UploadRecord[]`, newest first | – |
| `POST` | `/api/uploads` | multipart, field `image` | `201` the `UploadRecord` | `400` no/empty file, `413` > 5 MB, `415` not a supported image |
| `GET` | `/uploads/:filename` | – | `200` the image bytes | `400` invalid name, `404` unknown |

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
bun test               # 12 tests, run in a temporary folder

# terminal 2
cd week-05/image-gallery-client
bun run dev            # http://localhost:5173
```

## Project structure

```
week-05/
├── shared/
│   ├── types.ts                    UploadRecord, ApiResult<T>
│   └── upload-rules.ts             MAX_UPLOAD_BYTES, ALLOWED_IMAGE_TYPES (values, used by both sides)
├── image-gallery-api/src/
│   ├── main.ts                     ensureStorage(), Bun.serve with middleware and a body size limit
│   ├── config.ts                   PORT, UPLOADS_DIR, DATA_DIR, MAX_REQUEST_BYTES
│   ├── router.ts                   the three handlers, routes, fallback
│   ├── middleware/
│   │   ├── middleware.ts           Handler/Middleware types, applyMiddleware()
│   │   └── logger.ts               withLogging
│   ├── services/
│   │   └── upload-service.ts       validation, file writing, JSON "database"
│   └── util/
│       └── response.ts             ok(), fail(), corsHeaders() (moved out of the router)
└── image-gallery-client/src/
    ├── App.tsx                     state, initial load, upload flow
    ├── api.ts                      fetchUploads(), uploadImage(), imageUrl()
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
  headers: {
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=31536000, immutable",
  },
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
  (`immutable`).

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
Hono, and of week 8's authentication (`withAuth`, `withAdmin`).

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

**Front-end**

7. `api.ts`: `uploadImage` with `FormData`, `imageUrl()`.
8. `UploadForm`, `Gallery`, `StatusBanner`, then `App`.
9. Try uploading a text file, a large file, and an image renamed from `.txt`.

## Compared with last year's Deno version

- `Bun.write`/`Bun.file` instead of `Deno.writeFile`/`Deno.readFile`; no
  hand-written MIME-type table, no `--allow-read`/`--allow-write`.
- New: size limit (`413`), type allowlist (`415`), magic-byte check, `nosniff`
  and caching headers, `maxRequestBodySize`, shared validation rules.
- Error responses use the `{ ok: false, error: { message } }` envelope the
  client expects (last year they were plain strings and showed as `undefined`).
- Middleware is applied to the whole routes table with `applyMiddleware()`.

## Exercises

1. Add `GET /api/uploads/:id` returning one record (`404` if unknown).
2. Serialise writes to `uploads.json` so concurrent uploads cannot lose
   records: keep a module-level `let queue = Promise.resolve()` and chain each
   read-modify-write onto it. Write a test that uploads ten files with
   `Promise.all` and checks that all ten records exist (it fails without the
   queue).
3. Write a `withTiming` middleware that adds a `Server-Timing` header to every
   response. Apply both middlewares and decide the order.
4. Show a preview of the selected image before uploading.
   `URL.createObjectURL(file)` creates a temporary URL for a `File`; release it
   with `URL.revokeObjectURL` in an effect's cleanup. Check that it works under
   `StrictMode`.

## Further reading

- [Bun: File I/O](https://bun.sh/docs/runtime/file-io)
- [MDN: Using FormData objects](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest_API/Using_FormData_Objects)
- [Wikipedia: List of file signatures (magic numbers)](https://en.wikipedia.org/wiki/List_of_file_signatures)
- [OWASP: File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
