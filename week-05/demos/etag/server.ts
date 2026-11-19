// The same JSON served twice: once without and once with an ETag.
//
//   bun etag/server.ts              →  http://localhost:3003
//
// Open /without and /with with DevTools → Network open and reload each a few
// times. Both answer "Cache-Control: no-cache", which means "you may keep a
// copy, but ask me before you use it". Only /with gives the browser a way to
// ask cheaply, so only /with can answer "304 Not Modified" without a body.

type Product = { id: number; name: string; price: number; description: string };

// About 500 kB of JSON, so the difference shows in the Network tab.
const products: Product[] = Array.from({ length: 4000 }, (_, i) => ({
  id: i + 1,
  name: `Product ${i + 1}`,
  price: (((i * 37) % 1000) + 99) / 100,
  description: "An ordinary product that exists only to make this response big.",
}));

// The body and its ETag are computed only when the data changes, so answering
// 304 costs the server almost nothing. The ETag is a hash of the body: the same
// bytes give the same tag, one changed price gives a new tag.
let body = "";
let etag = "";
function rebuild() {
  body = JSON.stringify(products);
  etag = `"${Bun.hash(body).toString(16)}"`;
}
rebuild();

// Bytes of body sent so far by each route, for the log.
const totals: Record<string, number> = { "/without": 0, "/with": 0 };

const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>ETag demo</title>
<style>body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; }</style>
<h1>ETag demo</h1>
<p>Open DevTools → Network ("Disable cache" must be off). Open a link, reload it a few
times, and compare the Status and Size columns. The terminal logs every request.</p>
<ul>
  <li><a href="/without">/without</a>: no ETag, the whole JSON every time</li>
  <li><a href="/with">/with</a>: an ETag, then 304 Not Modified with an empty body</li>
</ul>
<form method="post" action="/change">
  <button>Change one price</button> The ETag changes, so /with sends the new JSON once.
</form>`;

const server = Bun.serve({
  port: 3003,
  routes: {
    "/": () => new Response(PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }),

    // WITHOUT an ETag: the browser cannot ask "has it changed?", so every
    // request downloads the whole body again.
    "/without": (req) => {
      log(req, 200, body);
      return new Response(body, {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
      });
    },

    // WITH an ETag: the first response carries the tag. On the next request the
    // browser sends it back in If-None-Match. If it still matches, the answer
    // is 304 with no body, and the browser uses the copy it already has.
    // (The gallery's etagMatches() also handles lists, "*" and weak W/ tags.)
    "/with": (req) => {
      const headers = { "Content-Type": "application/json", "Cache-Control": "no-cache", ETag: etag };
      if (req.headers.get("If-None-Match") === etag) {
        log(req, 304, "");
        return new Response(null, { status: 304, headers });
      }
      log(req, 200, body);
      return new Response(body, { headers });
    },

    // Change one price, so /with has to send the new JSON (and a new tag) once.
    "/change": {
      POST: () => {
        products[0]!.price = Math.round(Math.random() * 10000) / 100;
        rebuild();
        console.log(`\ndata changed: the new ETag is ${etag}\n`);
        return new Response(null, { status: 303, headers: { Location: "/" } });
      },
    },
  },
});

console.log(`ETag demo at ${server.url}  (the current ETag is ${etag})`);

function log(req: Request, status: number, sentBody: string) {
  const route = new URL(req.url).pathname;
  const bytes = Buffer.byteLength(sentBody);
  totals[route] = (totals[route] ?? 0) + bytes;
  const asked = req.headers.get("If-None-Match") ?? "(none)";
  console.log(
    `GET ${route.padEnd(8)} If-None-Match: ${asked.padEnd(20)} → ${status}, ${size(bytes)} sent` +
      `   (all requests to ${route}: ${size(totals[route])})`,
  );
}

function size(bytes: number) {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
