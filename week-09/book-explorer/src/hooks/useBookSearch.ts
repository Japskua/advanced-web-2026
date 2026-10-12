/**
 * useBookSearch(query, page, sort): searches Open Library and returns
 * { books, total, loading, error }.
 *
 * A custom hook is a function whose name starts with "use" and that calls
 * other hooks. It packages stateful logic (here: fetching, cancelling, loading
 * and error state) so components only describe *what* they want.
 *
 * Two details worth studying:
 *
 * 1. Cancellation. When the query or page changes while a request is running,
 *    the effect's cleanup aborts the old request. Without it, a slow old
 *    response could arrive after a fast new one and overwrite it (a race
 *    condition).
 *
 * 2. Loading is *derived*, not stored. Each result is saved together with the
 *    key of the request that produced it. If that key differs from the current
 *    request's key, the result is stale, so we are loading. This avoids
 *    calling setLoading(true) synchronously inside the effect (which forces an
 *    extra render and which React's lint rules reject), and it lets the
 *    previous page stay on screen while the next one loads.
 */
import { useEffect, useState } from "react";
import { searchBooks } from "../api";
import type { Book, SortOrder } from "../types";

export const MIN_QUERY_LENGTH = 2;

interface StoredResult {
  key: string; // which request produced this result
  books: Book[];
  total: number;
  error: string;
}

export interface BookSearch {
  books: Book[];
  total: number;
  loading: boolean;
  error: string;
}

export function useBookSearch(query: string, page: number, sort: SortOrder): BookSearch {
  const trimmed = query.trim();
  const enabled = trimmed.length >= MIN_QUERY_LENGTH;
  const requestKey = JSON.stringify([trimmed, page, sort]);

  const [result, setResult] = useState<StoredResult | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();

    searchBooks(trimmed, page, sort, controller.signal)
      .then(({ books, total }) => {
        setResult({ key: requestKey, books, total, error: "" });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return; // cancelled on purpose, not an error
        const message = error instanceof Error ? error.message : "Failed to fetch books";
        setResult({ key: requestKey, books: [], total: 0, error: message });
      });

    return () => controller.abort();
  }, [enabled, requestKey, trimmed, page, sort]);

  if (!enabled) {
    return { books: [], total: 0, loading: false, error: "" };
  }

  const loading = result?.key !== requestKey;
  return {
    books: result?.books ?? [], // while loading: the previous results
    total: result?.total ?? 0,
    loading,
    error: loading ? "" : (result?.error ?? ""),
  };
}
