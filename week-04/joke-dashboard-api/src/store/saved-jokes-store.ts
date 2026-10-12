/**
 * Storage for saved jokes.
 *
 * The jokes are kept in memory, so they disappear when the server restarts.
 * The point of this module is its *interface*: the router calls addJoke(),
 * findByExternalId() and getSortedJokes() and does not know how the data is
 * stored. In week 6 the same kind of module (a "repository") talks to a
 * PostgreSQL database instead, and the router barely changes.
 */
import type { SavedJoke } from "@shared/types";

const savedJokes: SavedJoke[] = [];

export function addJoke(joke: SavedJoke): void {
  savedJokes.push(joke);
}

export function findByExternalId(externalId: number): SavedJoke | undefined {
  return savedJokes.find((joke) => joke.externalId === externalId);
}

// Newest first. Jokes are appended as they are saved, so the array is already
// in chronological order: reversing a copy is enough. (Sorting by `savedAt`
// would put two jokes saved in the same millisecond in the wrong order.)
// Copy first: reverse() works in place, and callers must not change the store.
export function getSortedJokes(): SavedJoke[] {
  return [...savedJokes].reverse();
}

// Only used by the tests, to start each test from an empty store.
export function clearJokes(): void {
  savedJokes.length = 0;
}
