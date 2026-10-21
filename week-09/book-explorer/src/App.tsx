import { useCallback, useMemo, useState, type ReactNode } from "react";
import { cn } from "cn";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { PAGE_SIZE } from "./api";
import BookGrid from "./components/BookGrid";
import ControlsBar from "./components/ControlsBar";
import FavoritesPanel from "./components/FavoritesPanel";
import Pager from "./components/Pager";
import SearchBar from "./components/SearchBar";
import { MIN_QUERY_LENGTH, useBookSearch } from "./hooks/useBookSearch";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { useLocalStorage } from "./hooks/useLocalStorage";
import type { Book, SortOrder } from "./types";

// Open Library can report hundreds of thousands of matches; nobody pages that
// far, and deep pages are slow, so the pager stops here.
const MAX_PAGES = 50;

export default function App() {
  // --- State --------------------------------------------------------------
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortOrder>("relevance");
  const [onlyWithCover, setOnlyWithCover] = useState(false);
  const [favorites, setFavorites] = useLocalStorage<Book[]>("book-explorer:favorites", []);

  // --- Custom hooks composed together -------------------------------------
  // The input updates `query` on every keystroke; the search only sees the
  // debounced value.
  const debouncedQuery = useDebouncedValue(query, 400);
  const { books, total, loading, error } = useBookSearch(debouncedQuery, page, sort);

  // --- Event handlers ----------------------------------------------------
  // A new query or sort order starts again from page 1. Resetting the page
  // here, in the handler, is simpler and more direct than an effect that
  // watches `query` and resets the page afterwards.
  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  function handleSortChange(value: SortOrder) {
    setSort(value);
    setPage(1);
  }

  function handlePageChange(value: number) {
    setPage(value);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // useCallback returns the *same* function on every render (its dependencies
  // never change: setFavorites from useState is stable). The memoised
  // BookCards therefore only re-render when their own `isFavorite` changes.
  const toggleFavorite = useCallback(
    (book: Book) => {
      setFavorites((prev) =>
        prev.some((fav) => fav.key === book.key) ? prev.filter((fav) => fav.key !== book.key) : [...prev, book],
      );
    },
    [setFavorites],
  );

  // --- Derived data with useMemo -----------------------------------------
  // A Set makes "is this book a favourite?" a constant-time lookup for each of
  // the 24 cards. Rebuilt only when the favourites change.
  const favoriteKeys = useMemo(() => new Set(favorites.map((book) => book.key)), [favorites]);

  // A client-side filter on the current page. Recomputed only when the books
  // or the filter change, not when, say, the user types in the search box.
  const visibleBooks = useMemo(
    () => (onlyWithCover ? books.filter((book) => book.coverId !== undefined) : books),
    [books, onlyWithCover],
  );

  const pageCount = Math.min(Math.ceil(total / PAGE_SIZE), MAX_PAGES);
  const queryTooShort = debouncedQuery.trim().length < MIN_QUERY_LENGTH;

  // --- Rendering -----------------------------------------------------------
  let results: ReactNode;
  if (queryTooShort) {
    results = <p className="text-muted-foreground">Type at least {MIN_QUERY_LENGTH} characters to search.</p>;
  } else if (error) {
    results = (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  } else if (loading && books.length === 0) {
    results = (
      <div className="flex justify-center py-12">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  } else if (!loading && books.length === 0) {
    results = <p className="text-muted-foreground">No books found for “{debouncedQuery}”.</p>;
  } else {
    results = (
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} results · page {page} of {pageCount}
          {onlyWithCover && ` · showing ${visibleBooks.length} with a cover`}
        </p>

        {/*
          While the next page loads, the previous one stays visible, dimmed.
          cn() joins class names and leaves out false ones: "opacity-50" only
          while loading.
        */}
        <div className={cn("transition-opacity duration-150", loading && "opacity-50")} aria-busy={loading}>
          <BookGrid books={visibleBooks} favoriteKeys={favoriteKeys} onToggleFavorite={toggleFavorite} />
        </div>

        {pageCount > 1 && <Pager count={pageCount} page={page} onPageChange={handlePageChange} />}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-screen-2xl gap-6 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-3xl">Book Explorer</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SearchBar query={query} onQueryChange={handleQueryChange} />
          <ControlsBar
            sort={sort}
            onSortChange={handleSortChange}
            onlyWithCover={onlyWithCover}
            onOnlyWithCoverChange={setOnlyWithCover}
          />
        </CardContent>
      </Card>

      {/*
        One column on small screens. From the lg breakpoint (1024px) up, two:
        300px for the favourites and the rest (1fr) for the results.
      */}
      <div className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
        <FavoritesPanel favorites={favorites} onRemove={toggleFavorite} />
        <section aria-label="Search results">{results}</section>
      </div>
    </div>
  );
}
