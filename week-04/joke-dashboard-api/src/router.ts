import type { ApiResult, SavedJoke } from "@shared/types";
import { fetchJokeFromExternalApi } from "./services/external-joke-service";
import { addJoke, findByExternalId, getSortedJokes } from "./store/saved-jokes-store";
import { parseSaveJokeBody, readJson } from "./validation";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
// The React client runs on http://localhost:5173 and this API on
// http://localhost:8000. Different port = different *origin*, and browsers
// block a page from reading responses from another origin unless that origin
// explicitly allows it. These headers are how the API allows it:
//
//   Access-Control-Allow-Origin   which origins may read the responses ("*" = any)
//   Access-Control-Allow-Methods  which methods may be used cross-origin
//   Access-Control-Allow-Headers  which request headers may be sent
//
// CORS is covered properly in weeks 10–12. "*" is fine for a public API with
// no logins; it is *not* fine once cookies or tokens are involved.
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// ---------------------------------------------------------------------------
// Response helpers (with CORS headers on every response)
// ---------------------------------------------------------------------------
function ok<T>(data: T, status = 200): Response {
  const body: ApiResult<T> = { ok: true, data };
  return Response.json(body, { status, headers: corsHeaders() });
}

function fail(message: string, status: number): Response {
  const body: ApiResult<never> = { ok: false, error: { message } };
  return Response.json(body, { status, headers: corsHeaders() });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// GET /api/joke – fetch a fresh joke through the external service.
async function getJoke(): Promise<Response> {
  try {
    const joke = await fetchJokeFromExternalApi();
    return ok(joke);
  } catch (error: unknown) {
    // The problem is not in our server and not in the client's request, but in
    // the server *we* called. HTTP has status codes for exactly that:
    //   504 Gateway Timeout  the upstream server did not answer in time
    //   502 Bad Gateway      the upstream server answered with an error
    console.error("Fetching a joke failed:", error);

    if (error instanceof Error && error.name === "TimeoutError") {
      return fail("The joke service did not respond in time", 504);
    }
    return fail("The joke service is unavailable", 502);
  }
}

// GET /api/saved – list saved jokes, newest first.
function listSavedJokes(): Response {
  return ok(getSortedJokes());
}

// POST /api/saved – save a joke.
async function saveJoke(req: Request): Promise<Response> {
  const body = parseSaveJokeBody(await readJson(req));
  if (!body) {
    return fail("Invalid body. Expected { externalId: number, category: string, text: string }", 400);
  }

  // 409 Conflict: the request is valid, but clashes with the current state of
  // the resource (this joke is already saved).
  if (findByExternalId(body.externalId)) {
    return fail("This joke is already saved", 409);
  }

  // The server, not the client, decides the id and the timestamp.
  const joke: SavedJoke = {
    id: crypto.randomUUID(),
    ...body,
    savedAt: new Date().toISOString(),
  };
  addJoke(joke);

  return ok(joke, 201);
}

// ---------------------------------------------------------------------------
// Routes and fallback
// ---------------------------------------------------------------------------
export const routes = {
  "/api/joke": { GET: getJoke },
  "/api/saved": { GET: listSavedJokes, POST: saveJoke },
};

export function fallback(req: Request): Response {
  // CORS preflight. Before a cross-origin POST with a JSON body, the browser
  // first sends an OPTIONS request to ask whether the real request is allowed.
  // Our route table has no OPTIONS handlers, so the preflight ends up here.
  // 204 No Content + the CORS headers = "yes, go ahead".
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  return fail("Not found", 404);
}
