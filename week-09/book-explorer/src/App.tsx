import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Container,
  Pagination,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { PAGE_SIZE } from "./api";
import BookGrid from "./components/BookGrid";
import ControlsBar from "./components/ControlsBar";
import FavoritesPanel from "./components/FavoritesPanel";
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
    results = <Typography color="text.secondary">Type at least {MIN_QUERY_LENGTH} characters to search.</Typography>;
  } else if (error) {
    results = <Alert severity="error">{error}</Alert>;
  } else if (loading && books.length === 0) {
    results = (
      <Box sx={{ textAlign: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  } else if (!loading && books.length === 0) {
    results = <Typography color="text.secondary">No books found for “{debouncedQuery}”.</Typography>;
  } else {
    results = (
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {total.toLocaleString()} results · page {page} of {pageCount}
          {onlyWithCover && ` · showing ${visibleBooks.length} with a cover`}
        </Typography>

        {/* While the next page loads, the previous one stays visible, dimmed. */}
        <Box sx={{ opacity: loading ? 0.5 : 1, transition: "opacity 150ms" }} aria-busy={loading}>
          <BookGrid books={visibleBooks} favoriteKeys={favoriteKeys} onToggleFavorite={toggleFavorite} />
        </Box>

        {pageCount > 1 && (
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_event, value) => handlePageChange(value)}
            color="primary"
            sx={{ alignSelf: "center" }}
          />
        )}
      </Stack>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h4" component="h1">
              Book Explorer
            </Typography>
            <SearchBar query={query} onQueryChange={handleQueryChange} />
            <ControlsBar
              sort={sort}
              onSortChange={handleSortChange}
              onlyWithCover={onlyWithCover}
              onOnlyWithCoverChange={setOnlyWithCover}
            />
          </Stack>
        </Paper>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "300px 1fr" }, gap: 3 }}>
          <FavoritesPanel favorites={favorites} onRemove={toggleFavorite} />
          <Box component="section" aria-label="Search results">
            {results}
          </Box>
        </Box>
      </Stack>
    </Container>
  );
}
