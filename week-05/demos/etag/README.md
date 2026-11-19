# ETag: without and with

One server, one file. It serves the same JSON document (about 500 kB) twice:
`/without` sends it in full every time, while `/with` also sends an **ETag**,
so that later requests can be answered `304 Not Modified` with no body. The
Network tab and the server's terminal show the difference in bytes.

```
etag/
└── server.ts     Bun.serve: a start page, /without, /with and POST /change
```

## Run it

```bash
cd week-05/demos
bun etag/server.ts              # or: bun run etag
```

Open http://localhost:3003 and DevTools → Network. Make sure **Disable cache**
is *off*: with it on, the browser never sends `If-None-Match` and every
request is a `200`.

## What to show in class

1. **`/without`.** Click the link and reload three times. Every row in the
   Network tab is `200` with about 506 kB, and every line in the terminal
   adds 506 kB to the total:

   ```
   GET /without If-None-Match: (none)               → 200, 506 kB sent   (all requests to /without: 1.5 MB)
   ```

2. **`/with`.** Go back, click the link and reload three times. The first row
   is `200` with 506 kB; the rest are `304` and transfer only the headers (a
   couple of hundred bytes):

   ```
   GET /with    If-None-Match: (none)               → 200, 506 kB sent   (all requests to /with: 506 kB)
   GET /with    If-None-Match: "995a05c17caa9ea7"   → 304, 0 B sent   (all requests to /with: 506 kB)
   ```

   Click a `304` row. Under *Request Headers* is
   `If-None-Match: "995a05c17caa9ea7"`, which the browser added **by itself**
   because the first response had an `ETag`. The page and its JavaScript
   didn't do anything.
3. **Change the data.** Go back to the start page and click **Change one
   price**. The terminal prints the new ETag. Open `/with` again: one `200`
   with the new JSON, then `304`s again.

## The routes

| Method | Path | Answer |
| ------ | ---- | ------ |
| `GET` | `/` | The start page: two links and the *Change one price* button |
| `GET` | `/without` | `200` and the JSON, `Cache-Control: no-cache`, no ETag |
| `GET` | `/with` | `200` and the JSON with `ETag: "…"`, or `304` with no body when `If-None-Match` matches |
| `POST` | `/change` | Changes the first product's price, which gives a new ETag; `303` back to `/` |

## On the wire

```bash
curl -i http://localhost:3003/with
```

```
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-cache
ETag: "995a05c17caa9ea7"
Date: Mon, 23 Nov 2026 08:30:00 GMT
Content-Length: 505703

[{"id":1,"name":"Product 1","price":0.99,…
```

Send the tag back, as the browser does:

```bash
curl -i -H 'If-None-Match: "995a05c17caa9ea7"' http://localhost:3003/with
```

```
HTTP/1.1 304 Not Modified
Content-Type: application/json
Cache-Control: no-cache
ETag: "995a05c17caa9ea7"
Date: Mon, 23 Nov 2026 08:30:05 GMT
```

No body: the client uses the copy it already has. Count the bytes:

```bash
curl -s -o /dev/null -w "%{http_code}, %{size_download} bytes\n" http://localhost:3003/without
curl -s -o /dev/null -w "%{http_code}, %{size_download} bytes\n" -H 'If-None-Match: "995a05c17caa9ea7"' http://localhost:3003/with
```

Your ETag differs if the data has changed: copy it from the first response.
Unlike the browser, curl has no cache and never sends `If-None-Match` unless
you add it.

## How it works

### The body and its tag are built when the data changes

```ts
let body = "";
let etag = "";
function rebuild() {
  body = JSON.stringify(products);
  etag = `"${Bun.hash(body).toString(16)}"`;
}
rebuild();
```

The ETag is a hash of the body: the same bytes always give the same tag, and
one changed price gives a different one. An ETag is just a string in double
quotes chosen by the server. The browser never looks inside it, it only sends
it back. `Bun.hash` is a fast, non-cryptographic hash, which is enough here
because nobody is trying to forge a collision.

### The two routes

```ts
"/without": () =>
  new Response(body, { headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" } }),

"/with": (req) => {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-cache", ETag: etag };
  if (req.headers.get("If-None-Match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, { headers });
},
```

- **Both answer `Cache-Control: no-cache`**: "you may keep a copy, but check
  with me before you use it". The difference is that only `/with` gives the
  browser a way to check without downloading everything again.
- **The `304` carries the same `ETag` and `Cache-Control`** as the `200`
  would, so the browser can update what it knows about its copy.
- **The comparison is simplified.** `If-None-Match` may also hold a list
  (`"a", "b"`), `*`, or weak tags (`W/"a"`). The Image Gallery's
  `util/http-cache.ts` (`etagMatches()`) handles all of them.

### fetch() never sees the 304

Run this in the console of the start page twice:

```js
const res = await fetch("/with");
console.log(res.status, (await res.text()).length);
```

Both times it prints `200` and the full length, although the Network tab
shows `304` for the second request. The browser revalidates, gets the `304`
and answers `fetch()` from its cache. The React code in the gallery therefore
needs no change to benefit from ETags.

## Where a good ETag comes from

| Source | Example | Note |
| ------ | ------- | ---- |
| A hash of the content | this demo | Always right, but the content must be built first. Hashing a body that is built for every request saves bandwidth, not server work. |
| A version number or `updated_at` | `"v42"`, a row's last update time | Cheap: known before the response is built, so the server can skip building it. Reset to `"v1"` after a restart and a browser may hold an old `"v1"` too. |
| File size and modification time | the gallery's images, nginx | Cheap for files. Two servers with different file times give different tags for the same file. |

The older, time-based mechanism is `Last-Modified` with `If-Modified-Since`.
It has only one-second precision, so two changes within the same second look
like one, and it depends on the server's clock. ETags are preferred when the
server can produce one.

The next step is to not ask at all. The gallery's images are served with
`Cache-Control: public, max-age=31536000, immutable`. Their names never get
new content, so the browser reuses them for a year without any request
("memory cache" or "disk cache" in the Network tab).

## Common mistakes

- **DevTools has *Disable cache* on.** Then there is no `If-None-Match` and no
  `304`.
- **Comparing the tag without its quotes.** The header value includes the
  double quotes: `"995a05c17caa9ea7"`, not `995a05c17caa9ea7`.
- **Tags that differ between servers** behind a load balancer, for example
  from file times. A request that lands on another server than last time gets
  a `200`, as if there were no ETag.
- **Expecting a 304 to save server work** when the body is built and hashed on
  every request anyway.

## Try it yourself

1. Add `/modified`, which uses `Last-Modified` and `If-Modified-Since`
   instead of an ETag. Remember the time of the last change, and answer `304`
   when the request's time is not older.
2. Use a version counter (`"v1"`, `"v2"`, …) as the ETag instead of a hash.
   What goes wrong if the server restarts and starts again from `"v1"`?
3. Make the comparison handle `*` and lists like `"a", "b"`, then compare
   your version with `etagMatches()` in the gallery.
4. Change `/with` to `Cache-Control: max-age=10`. For ten seconds after a
   download, clicking the link again (not reloading) sends no request at all;
   after that, the browser revalidates. (Reloading always revalidates.)
5. Make the 304 case cheaper still: keep the ETag in a variable and change it
   only in `/change`, without rebuilding the body until somebody asks for it.

## Further reading

- [MDN: HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
- [MDN: ETag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag)
- [MDN: If-None-Match](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-None-Match)
- [RFC 9110: Conditional requests](https://www.rfc-editor.org/rfc/rfc9110#name-conditional-requests)
