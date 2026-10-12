// Tests for the Joke Dashboard API.
//
// The API calls JokeAPI over the internet. Tests should not depend on another
// company's server being up, so calls to JokeAPI are replaced with a *mock*:
// spyOn() wraps the global fetch, and our replacement answers JokeAPI URLs
// itself while letting every other request (the tests calling our own server)
// through to the real fetch.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Server } from "bun";
import type { ApiResult, Joke, SavedJoke } from "@shared/types";
import { fallback, routes } from "../src/router";
import { clearJokes } from "../src/store/saved-jokes-store";

const realFetch = globalThis.fetch;
let jokeApiReply: () => Response | Promise<Response>;

const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(((input: string | URL | Request, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url.startsWith("https://v2.jokeapi.dev/")) return Promise.resolve(jokeApiReply());
  return realFetch(input, init);
}) as typeof fetch);

let server: Server<undefined>;
let baseUrl: string;

// The failure tests make the API log errors on purpose; keep them out of the output.
const consoleError = spyOn(console, "error").mockImplementation(() => {});

beforeAll(() => {
  server = Bun.serve({ port: 0, routes, fetch: fallback });
  baseUrl = server.url.origin;
});
afterAll(() => {
  server.stop(true);
  fetchSpy.mockRestore();
  consoleError.mockRestore();
});
beforeEach(() => {
  jokeApiReply = () =>
    Response.json({ error: false, id: 42, category: "Programming", type: "single", joke: "A test joke" });
});
afterEach(() => clearJokes());

async function read<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
}

function postSaved(body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/api/saved`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/joke", () => {
  test("maps JokeAPI's format to our Joke type", async () => {
    const res = await fetch(`${baseUrl}/api/joke`);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");

    const payload = await read<Joke>(res);
    if (!payload.ok) throw new Error("expected success");
    expect(payload.data).toMatchObject({ externalId: 42, category: "Programming", text: "A test joke" });
    expect(Date.parse(payload.data.fetchedAt)).not.toBeNaN();
  });

  test("answers 502 when JokeAPI fails", async () => {
    jokeApiReply = () => new Response("down", { status: 503 });
    const res = await fetch(`${baseUrl}/api/joke`);
    expect(res.status).toBe(502);
    expect(await read<never>(res)).toEqual({ ok: false, error: { message: "The joke service is unavailable" } });
  });

  test("answers 504 when JokeAPI times out", async () => {
    jokeApiReply = () => Promise.reject(new DOMException("The operation timed out.", "TimeoutError"));
    const res = await fetch(`${baseUrl}/api/joke`);
    expect(res.status).toBe(504);
  });
});

describe("saved jokes", () => {
  test("POST saves a joke and GET lists it", async () => {
    const res = await postSaved({ externalId: 1, category: "Programming", text: " Joke one " });
    expect(res.status).toBe(201);

    const created = await read<SavedJoke>(res);
    if (!created.ok) throw new Error("expected success");
    expect(created.data).toMatchObject({ externalId: 1, category: "Programming", text: "Joke one" });
    expect(created.data.id).toHaveLength(36); // a UUID

    const list = await read<SavedJoke[]>(await fetch(`${baseUrl}/api/saved`));
    expect(list).toEqual({ ok: true, data: [created.data] });
  });

  test("the list is sorted newest first", async () => {
    // No pause between the saves: the order must hold even within one millisecond.
    await postSaved({ externalId: 1, category: "c", text: "first" });
    await postSaved({ externalId: 2, category: "c", text: "second" });

    const list = await read<SavedJoke[]>(await fetch(`${baseUrl}/api/saved`));
    if (!list.ok) throw new Error("expected success");
    expect(list.data.map((j) => j.text)).toEqual(["second", "first"]);
  });

  test("saving the same joke twice gives 409 Conflict", async () => {
    await postSaved({ externalId: 7, category: "c", text: "t" });
    const res = await postSaved({ externalId: 7, category: "c", text: "t" });
    expect(res.status).toBe(409);
  });

  test.each([
    ["missing externalId", { category: "c", text: "t" }],
    ["blank text", { externalId: 1, category: "c", text: "  " }],
    ["string id", { externalId: "1", category: "c", text: "t" }],
  ])("rejects %s with 400", async (_label, body) => {
    const res = await postSaved(body);
    expect(res.status).toBe(400);
  });
});

describe("CORS and fallback", () => {
  test("a preflight request gets 204 and the CORS headers", async () => {
    const res = await fetch(`${baseUrl}/api/saved`, {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:5173", "Access-Control-Request-Method": "POST" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
    expect(res.headers.get("access-control-allow-headers")).toContain("Content-Type");
  });

  test("an unknown route gives a JSON 404", async () => {
    const res = await fetch(`${baseUrl}/api/nope`);
    expect(res.status).toBe(404);
    expect((await read<never>(res)).ok).toBe(false);
  });
});
