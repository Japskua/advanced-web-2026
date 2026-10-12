/**
 * The Open Library search API: https://openlibrary.org/dev/docs/api/search
 *
 * This week has no back-end of our own: the browser calls a public API
 * directly. Open Library allows that (it sends CORS headers).
 */
import type { SearchResult, SortOrder } from "./types";

const OPEN_LIBRARY = "https://openlibrary.org";
export const PAGE_SIZE = 24;

// The parts of Open Library's response we use. Kept private to this module and
// mapped to our own Book type, so the rest of the app never depends on
// Open Library's field names.
type OpenLibraryDoc = {
  key: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  edition_count?: number;
};

type OpenLibraryResponse = {
  numFound: number;
  docs: OpenLibraryDoc[];
};

export async function searchBooks(
  query: string,
  page: number,
  sort: SortOrder,
  signal?: AbortSignal,
): Promise<SearchResult> {
  const url = new URL("/search.json", OPEN_LIBRARY);
  url.searchParams.set("q", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(PAGE_SIZE));
  // Ask only for the fields we use: a much smaller response.
  url.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i,edition_count");
  if (sort !== "relevance") url.searchParams.set("sort", sort);

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Open Library request failed (${res.status})`);
  }

  const data = (await res.json()) as OpenLibraryResponse;

  return {
    total: data.numFound,
    books: data.docs.map((doc) => ({
      key: doc.key,
      title: doc.title ?? "Untitled",
      authors: doc.author_name ?? ["Unknown author"],
      firstPublishYear: doc.first_publish_year,
      coverId: doc.cover_i,
      editionCount: doc.edition_count ?? 0,
    })),
  };
}

// `?default=false` makes Open Library answer 404 instead of a blank image when
// there is no cover, so <img onError> can show our own placeholder.
export function coverUrl(coverId: number): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg?default=false`;
}
