/**
 * All communication with the back-end goes through this module.
 *
 * Components never call fetch() themselves. They call fetchJoke(),
 * fetchSavedJokes() and saveJoke(), which return typed data or throw an
 * ApiError with a message that can be shown to the user.
 */
import type { ApiResult, Joke, SaveJokeBody, SavedJoke } from "@shared/types";
import { API_URL } from "./config";

// An Error that also remembers the HTTP status code (0 = no response at all).
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * A generic request helper. The type parameter T is the type of `data` in a
 * successful response, so the caller decides what it expects:
 *
 *   const jokes = await request<SavedJoke[]>("/api/saved");
 *
 * Every failure mode ends up as an ApiError:
 *  - the server cannot be reached at all (fetch itself throws)
 *  - the response is not JSON
 *  - the response is our error envelope { ok: false, error: { message } }
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch (error) {
    // An aborted request is not an error to report: the component cancelled it.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Cannot reach the server. Is the API running?", 0);
  }

  let payload: ApiResult<T>;
  try {
    payload = (await res.json()) as ApiResult<T>;
  } catch {
    throw new ApiError(`Unexpected response from the server (HTTP ${res.status})`, res.status);
  }

  if (!payload.ok) {
    throw new ApiError(payload.error.message, res.status);
  }
  return payload.data;
}

// An AbortSignal lets the caller cancel the request (see useEffect in App).
export function fetchJoke(signal?: AbortSignal): Promise<Joke> {
  return request<Joke>("/api/joke", { signal });
}

export function fetchSavedJokes(signal?: AbortSignal): Promise<SavedJoke[]> {
  return request<SavedJoke[]>("/api/saved", { signal });
}

// SaveJokeBody is Pick<Joke, "externalId" | "category" | "text">: the client
// sends only what the server cannot generate itself.
export function saveJoke(joke: SaveJokeBody): Promise<SavedJoke> {
  return request<SavedJoke>("/api/saved", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(joke),
  });
}
