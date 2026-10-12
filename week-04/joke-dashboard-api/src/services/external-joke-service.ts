/**
 * A service for the external joke API.
 *
 * This week we start separating the application's *logic* from its *routing*.
 * Everything about JokeAPI (its URL, its response format, how to call it) lives
 * in this one module. If we switched to another joke provider, only this file
 * would change; the router and the client would not notice.
 *
 * More free APIs for practice: https://github.com/public-api-lists/public-api-lists
 */
import type { Joke } from "@shared/types";

const EXTERNAL_JOKE_API = "https://v2.jokeapi.dev/joke/Programming?type=single&safe-mode";
const TIMEOUT_MS = 5000;

// The parts of JokeAPI's response we use. This type is private to the service:
// the rest of the application only sees our own `Joke` type.
type JokeApiResponse =
  | { error: false; id: number; category: string; joke: string }
  | { error: true; message: string };

export async function fetchJokeFromExternalApi(): Promise<Joke> {
  // Never wait forever for another server. AbortSignal.timeout() cancels the
  // request after TIMEOUT_MS and makes fetch() throw a "TimeoutError".
  const response = await fetch(EXTERNAL_JOKE_API, { signal: AbortSignal.timeout(TIMEOUT_MS) });

  if (!response.ok) {
    throw new Error(`JokeAPI responded with ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as JokeApiResponse;
  if (data.error) {
    throw new Error(`JokeAPI returned an error: ${data.message}`);
  }

  // Map the external format to our own type.
  return {
    externalId: data.id,
    category: data.category,
    text: data.joke,
    fetchedAt: new Date().toISOString(),
  };
}
