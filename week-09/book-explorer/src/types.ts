// The app's own types. Open Library's response format stays inside api.ts.

export interface Book {
  key: string; // Open Library's id, e.g. "/works/OL893415W"
  title: string;
  authors: string[];
  firstPublishYear?: number;
  coverId?: number;
  editionCount: number;
}

// Sort orders supported by the Open Library search API.
export type SortOrder = "relevance" | "new" | "old";

export interface SearchResult {
  books: Book[];
  total: number; // how many books match in total, across all pages
}
