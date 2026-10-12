# Week 4 – Full-stack application data flow

This week connects the two halves: a Bun API and a React client running as
separate programs, talking over HTTP. The application is a **Joke Dashboard**.
The API fetches programming jokes from the public [JokeAPI](https://jokeapi.dev),
and keeps a list of saved jokes. The client shows the current joke, refreshes
it every ten seconds, and lets the user save jokes.

New on the client: the **`useEffect`** hook, asynchronous data fetching with
cancellation, and loading and error states. New on the server: a **service
layer**, calling another API, **CORS**, and status codes for errors that are
not the client's fault. Both sides share one file of **TypeScript types**.

## Learning objectives

After this week you can:

- fetch data in React with `useEffect`, and clean up with `AbortController` and the effect's cleanup function
- design separate loading, error and success states for each part of a page
- explain why the browser needs CORS headers and what a preflight request is
- separate routing from application logic with a service module
- call an external API from the back-end safely: timeouts, mapping its data to your own type, `502`/`504` on failure
- share TypeScript types between back-end and front-end so the contract is checked by the compiler
- use `409 Conflict` and the other status codes from weeks 2 and 4 correctly

## Architecture

```
┌────────────── browser ──────────────┐        ┌──────────── Bun ────────────┐        ┌─────────┐
│ React client  http://localhost:5173 │  HTTP  │ API  http://localhost:8000  │  HTTP  │ JokeAPI │
│                                     │ ─────▶ │ router → service ───────────┼──────▶ │         │
│ App ─ useEffect ─ api.ts ─ fetch    │ ◀───── │        → store (in memory)  │ ◀───── │         │
└─────────────────────────────────────┘  JSON  └─────────────────────────────┘  JSON  └─────────┘
                     ▲                                        ▲
                     └──────── import type ── shared/types.ts ┘
```

| Method | Path | Body | Success | Errors |
| ------ | ---- | ---- | ------- | ------ |
| `GET` | `/api/joke` | – | `200` a fresh `Joke` | `502` JokeAPI failed, `504` JokeAPI timed out |
| `GET` | `/api/saved` | – | `200` `SavedJoke[]`, newest first | – |
| `POST` | `/api/saved` | `{ externalId, category, text }` | `201` the `SavedJoke` | `400` invalid body, `409` already saved |

## Running it

Two terminals:

```bash
# terminal 1
cd week-04/joke-dashboard-api
bun run dev            # http://localhost:8000
bun test               # 11 tests, JokeAPI is mocked

# terminal 2
cd week-04/joke-dashboard-client
bun run dev            # http://localhost:5173
```

## Project structure

```
week-04/
├── shared/
│   └── types.ts                       the API contract: Joke, SavedJoke, SaveJokeBody, ApiResult<T>
├── joke-dashboard-api/
│   ├── src/
│   │   ├── main.ts                    starts the server
│   │   ├── router.ts                  CORS, response helpers, handlers, routes, fallback
│   │   ├── validation.ts              readJson(), parseSaveJokeBody()
│   │   ├── services/
│   │   │   └── external-joke-service.ts   calls JokeAPI and maps its response
│   │   └── store/
│   │       └── saved-jokes-store.ts       in-memory storage behind a small interface
│   └── tests/api.test.ts
└── joke-dashboard-client/
    ├── index.html
    └── src/
        ├── main.tsx, App.tsx          state, effects and event handlers
        ├── api.ts                     request<T>() and one function per endpoint
        ├── config.ts                  API_URL
        ├── styles.css
        └── components/                Header, CurrentJokeCard, SavedJokesList, ErrorBanner
```

---

## Concepts: the back-end

### Shared types

Both projects import the API contract from `week-04/shared/types.ts`:

```ts
import type { Joke, SavedJoke } from "@shared/types";
```

`@shared/*` is a path alias defined in each project's `tsconfig.json`
(`"paths": { "@shared/*": ["../shared/*"] }`); Bun understands the same
setting. Because the import is `import type`, nothing from the file exists at
runtime: it is a compile-time contract.

Why bother? Last year's version had separate type definitions on each side,
and they drifted apart. The client expected `error.message` while the API sent
`error` as a string, and the client displayed a `fetchedAt` field that the API
never sent for saved jokes, so every saved joke showed "Invalid Date". With one
shared definition, such a mismatch is a compile error in whichever project uses
the type wrongly.

Only types that cross the network belong in `shared/`. The shape of JokeAPI's
own response stays private to the API's service.

### A service layer

`router.ts` only deals with HTTP: reading the request, choosing the status
code, writing the response. Everything about JokeAPI lives in
`services/external-joke-service.ts`:

```ts
export async function fetchJokeFromExternalApi(): Promise<Joke> {
  const response = await fetch(EXTERNAL_JOKE_API, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`JokeAPI responded with ${response.status} …`);

  const data = (await response.json()) as JokeApiResponse;
  if (data.error) throw new Error(`JokeAPI returned an error: ${data.message}`);

  return { externalId: data.id, category: data.category, text: data.joke, fetchedAt: new Date().toISOString() };
}
```

Three habits worth copying whenever you call someone else's server:

1. **Set a timeout.** Without one, a hanging external server makes your own
   requests hang too. `AbortSignal.timeout(ms)` is built into `fetch`.
2. **Check both levels of failure**: the HTTP status (`response.ok`) and the
   API's own error field.
3. **Map to your own type.** The rest of the application never sees JokeAPI's
   field names. Changing the provider later touches one file.

Similarly, `store/saved-jokes-store.ts` hides how saved jokes are stored. In
week 6 the same role is played by a *repository* that talks to PostgreSQL.

### Status codes for failures

| Code | When this API uses it |
| ---- | --------------------- |
| `400 Bad Request` | The body of `POST /api/saved` is invalid |
| `404 Not Found` | Unknown route |
| `409 Conflict` | The joke is already saved: the request is valid but clashes with the current state |
| `502 Bad Gateway` | JokeAPI answered with an error |
| `504 Gateway Timeout` | JokeAPI did not answer within 5 seconds |

`500 Internal Server Error` means *our* code failed. When another server
fails, `502`/`504` tell the client (and whoever reads the logs) where to look.
The detailed error is logged on the server with `console.error`; the client
only gets a short, safe message.

### CORS

The client is served from `http://localhost:5173`, the API from
`http://localhost:8000`. An **origin** is the combination of scheme, host and
port, so these are two different origins. By default, browsers do not let
JavaScript from one origin read responses from another (the *same-origin
policy*). **CORS** (Cross-Origin Resource Sharing) is how a server opts in:

```ts
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
```

- A simple `GET` is sent directly; the browser then checks the
  `Access-Control-Allow-Origin` header of the response before handing it to
  your code.
- A `POST` with `Content-Type: application/json` is not "simple". The browser
  first sends a **preflight** `OPTIONS` request asking for permission, and only
  sends the real request if the answer allows it. The route table has no
  `OPTIONS` handlers, so preflights reach `fallback`, which answers
  `204 No Content` with the CORS headers.

Open the browser's Network tab and save a joke: you will see the `OPTIONS`
request followed by the `POST`.

CORS is enforced by **browsers only**. `curl` ignores it completely. It
protects users' browsers from malicious pages, not your API from clients.
`"*"` is acceptable for a public API without logins; weeks 10–12 restrict it
to one origin.

## Concepts: the front-end

### Side effects and `useEffect`

Rendering must be *pure*: given the same props and state, a component returns
the same JSX and changes nothing outside itself. Fetching data, starting
timers and subscribing to events are **side effects**, and they belong in
`useEffect`, which runs *after* React has rendered:

```tsx
useEffect(() => {
  const controller = new AbortController();
  const { signal } = controller;

  fetchJoke(signal)
    .then(setCurrent)
    .catch((e) => { if (!signal.aborted) setJokeError(errorMessage(e, "…")); })
    .finally(() => { if (!signal.aborted) setLoadingJoke(false); });

  const intervalId = setInterval(() => { /* fetch a new joke */ }, REFRESH_MS);

  return () => {              // cleanup
    controller.abort();
    clearInterval(intervalId);
  };
}, []);                       // dependency array
```

- **Dependency array.** `[]` means "run once after the first render". Without
  the array the effect would run after *every* render, and since it sets state,
  it would loop forever. With `[a, b]` it re-runs whenever `a` or `b` changes.
- **Cleanup.** The returned function runs when the component is removed, and
  before the effect runs again. Every effect that starts something (a timer, a
  request, a subscription) should stop it here.
- **`AbortController`.** `controller.abort()` cancels the in-flight `fetch`.
  The `signal.aborted` checks stop us from setting state after cleanup.
- **StrictMode.** In development React mounts, unmounts and re-mounts every
  component once, so the effect runs twice and the cleanup in between. In the
  Network tab you will see the first requests cancelled. That is intended: it
  proves the cleanup works.

User actions (`handleNewJoke`, `handleSave`) are side effects too, but they
belong in **event handlers**, not effects: they happen because the user clicked,
not because the component rendered.

### Loading, error and empty states

Each section of the page has its own `loading` and `error` state, so a failure
in one does not blank the other:

| State | Joke card | Saved list |
| ----- | --------- | ---------- |
| loading | "Loading joke…" | "Loading saved jokes…" |
| error | `<ErrorBanner>` | error box inside the card |
| empty | – | "No saved jokes yet…" |
| success | the joke | the list |

Try it: stop the API while the client is open and press **New joke**. The
banner says *Cannot reach the server* and the last joke stays visible. Restart
the API and the next refresh recovers.

### One request helper for every endpoint

`api.ts` has a single generic function that every endpoint uses:

```ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Cannot reach the server. Is the API running?", 0);
  }

  const payload = (await res.json()) as ApiResult<T>;   // (simplified)
  if (!payload.ok) throw new ApiError(payload.error.message, res.status);
  return payload.data;
}

export function fetchJoke(signal?: AbortSignal): Promise<Joke> {
  return request<Joke>("/api/joke", { signal });
}
```

The generic `T` is chosen by each caller, and the `ApiResult<T>` union from
`shared/types.ts` makes `payload.data` available only after checking
`payload.ok`.

### Derived state

```tsx
const isSaved = current !== null && saved.some((joke) => joke.externalId === current.externalId);
```

Whether the current joke is saved can always be computed from `current` and
`saved`, so it is **not** stored in its own state. Storing it would mean keeping
two pieces of state in sync by hand.

### Utility types in the contract

```ts
export type SaveJokeBody = Pick<Joke, "externalId" | "category" | "text">;
```

The client sends only what the server cannot generate. The server adds `id`
and `savedAt`, which is why they appear in `SavedJoke` but not in the request
body.

---

## Lecture walkthrough

**Back-end first** (`joke-dashboard-api`):

1. Write `shared/types.ts`: `Joke`, `SavedJoke`, `SaveJokeBody`, `ApiResult<T>`.
   Configure the `@shared/*` path alias.
2. Write the service: call JokeAPI with a timeout, check both error levels, map
   to `Joke`.
3. Write the in-memory store (`addJoke`, `findByExternalId`, `getSortedJokes`).
4. Write `router.ts`: CORS headers, `ok`/`fail`, the three handlers, the routes,
   and the `OPTIONS` handling in `fallback`.
5. Check with curl before touching the client:

   ```bash
   curl http://localhost:8000/api/joke
   curl -X POST http://localhost:8000/api/saved -H "content-type: application/json" \
     -d '{"externalId":1,"category":"Programming","text":"A joke"}'
   curl http://localhost:8000/api/saved
   curl -i -X OPTIONS http://localhost:8000/api/saved     # the preflight answer
   ```

**Front-end** (`joke-dashboard-client`):

6. `config.ts` and `api.ts` with `request<T>()`.
7. The presentational components: `Header`, `CurrentJokeCard`,
   `SavedJokesList`, `ErrorBanner`.
8. `App.tsx`: state, the `useEffect` with initial load + polling + cleanup, then
   the two event handlers.
9. Demonstrate the loading and error states by stopping and restarting the API,
   and the preflight in the Network tab.

## Testing an API that calls another API

`tests/api.test.ts` must not depend on JokeAPI being online. It replaces the
global `fetch` with a spy that answers JokeAPI URLs itself and passes all other
requests (the tests calling our own server) to the real `fetch`:

```ts
const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url.startsWith("https://v2.jokeapi.dev/")) return Promise.resolve(jokeApiReply());
  return realFetch(input, init);
});
```

Each test sets `jokeApiReply` to whatever it needs: a normal joke, a `503`, or a
timeout. That is how the `502` and `504` paths are tested.

## Compared with last year's Deno version

- Fixed the client/API mismatches (error shape, `id` vs `externalId`,
  `fetchedAt` vs `savedAt`) by sharing the types.
- `502`/`504` instead of `500` when JokeAPI fails; a 5-second timeout.
- `409 Conflict` for saving the same joke twice (new).
- The JokeAPI URL used `safe=true`, which JokeAPI ignores; the correct flag is
  `safe-mode`.
- One generic `request<T>()` instead of three copies of the same fetch logic.

## Exercises

1. Add `DELETE /api/saved/:id` and a delete button in the list. Which status
   code should a successful delete return? What about deleting twice?
2. Pause polling while the browser tab is hidden (`document.visibilityState`
   and the `visibilitychange` event). Where does the event listener go, and
   where is it removed?
3. Show a "Retry" button in the error banner.
4. JokeAPI supports other categories. Add `GET /api/joke?category=Pun`, validate
   the category against a fixed list on the server, and add a selector to the
   client. Put the list of categories in `shared/`.

## Further reading

- [react.dev: Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [react.dev: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [MDN: Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- [MDN: AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [Bun: Mocks (`spyOn`, `mock`)](https://bun.sh/docs/test/mocks)
