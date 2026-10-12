# Week 9 – Advanced React

A front-end-only week. **Book Explorer** searches the public
[Open Library API](https://openlibrary.org/dev/docs/api/search) as you type,
pages through the results, and remembers favourite books in the browser.

The point is not the app but how its logic is organised: **custom hooks** that
package stateful behaviour, **reusable components**, **effects** that clean up
after themselves, and **performance** tools (`useMemo`, `useCallback`, `memo`)
used where they make a difference.

## Learning objectives

After this week you can:

- write custom hooks and compose them (`useDebouncedValue` → `useBookSearch`)
- write a generic hook (`useLocalStorage<T>`) with the same API as `useState`
- debounce user input and cancel outdated requests to avoid race conditions
- derive state instead of synchronising it, and know when an effect is *not* needed
- paginate results from an API
- explain referential equality and use `memo` + `useCallback` + `useMemo` correctly
- keep the code compatible with React's current lint rules (the React Compiler rules)

## Running it

```bash
cd week-09/book-explorer
bun run dev            # http://localhost:5173
bun run typecheck
```

From the repository root, `bun run lint` checks the hooks rules (see below).

## Project structure

```
week-09/book-explorer/src/
├── main.tsx                   ThemeProvider + CssBaseline
├── theme.ts
├── types.ts                   Book, SortOrder, SearchResult
├── api.ts                     searchBooks(), coverUrl(): Open Library → our types
├── App.tsx                    state, hook composition, handlers, derived data, layout
├── hooks/
│   ├── useDebouncedValue.ts   a value that updates only after a pause
│   ├── useBookSearch.ts       fetch + cancel + derived loading/error
│   └── useLocalStorage.ts     useState that persists
└── components/
    ├── SearchBar.tsx          controlled search input
    ├── ControlsBar.tsx        sort order, "only with cover" switch
    ├── BookGrid.tsx           responsive grid of cards
    ├── BookCard.tsx           one book (memoised)
    └── FavoritesPanel.tsx     the saved favourites
```

---

## Concepts

### Custom hooks

A custom hook is a function whose name starts with `use` and that calls other
hooks. It lets you extract stateful logic from a component the same way a
normal function extracts a calculation:

```tsx
// App.tsx: the component says *what* it needs…
const debouncedQuery = useDebouncedValue(query, 400);
const { books, total, loading, error } = useBookSearch(debouncedQuery, page, sort);
const [favorites, setFavorites] = useLocalStorage<Book[]>("book-explorer:favorites", []);
```

…and the hooks contain *how*. Each call has its own state; two components
using `useBookSearch` do not share results. Hooks follow the **rules of hooks**:
call them at the top level of a component or another hook, never inside
conditions or loops, because React identifies each hook by its call order.

These three hooks are useful in your project too. `useBookSearch` in
particular is a template for any "fetch data for these parameters" hook.

### Debouncing: `useDebouncedValue`

```ts
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timerId = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timerId);   // a new keystroke cancels the pending update
  }, [value, delayMs]);

  return debounced;
}
```

Typing "tolkien" changes `query` seven times, but `debouncedQuery` changes once,
400 ms after the last keystroke, so only one request is sent. The cleanup
function does the real work: every change cancels the previous timer.

### Fetching without race conditions: `useBookSearch`

Two problems appear as soon as requests depend on user input:

1. **Race conditions.** The user searches "dune", then quickly "dune messiah".
   If the first response arrives *after* the second, the screen shows the wrong
   results. The effect's cleanup aborts the outdated request:

   ```ts
   useEffect(() => {
     if (!enabled) return;
     const controller = new AbortController();
     searchBooks(trimmed, page, sort, controller.signal).then(…).catch(…);
     return () => controller.abort();
   }, [enabled, requestKey, trimmed, page, sort]);
   ```

2. **Loading state.** The obvious approach, `setLoading(true)` at the start of
   the effect, triggers an extra render and is rejected by React's current lint
   rules (`react-hooks/set-state-in-effect`). Instead, each stored result
   remembers which request produced it:

   ```ts
   const requestKey = JSON.stringify([trimmed, page, sort]);
   const [result, setResult] = useState<StoredResult | null>(null);
   // the effect stores { key: requestKey, books, total, error }

   const loading = result?.key !== requestKey;   // derived, never stored
   ```

   If the stored result belongs to an older request, we are loading. As a
   bonus, the old results stay on screen (dimmed) while the next page loads,
   instead of the page jumping to a spinner.

### Derive, don't synchronise

Several things in this app are *computed during render* instead of being kept
in their own state:

| Value | Derived from |
| ----- | ------------ |
| `loading` | the stored result's key vs. the current request key |
| `favoriteKeys` | `favorites` |
| `visibleBooks` | `books` + `onlyWithCover` |
| `pageCount` | `total` |

State that can be computed from other state should be computed. A second
`useState` would have to be updated in sync by hand, and sooner or later it
would not be.

The same thinking applies to effects. When the query changes, the page must go
back to 1. That could be an effect watching `query`, but it is simpler and
correct from the first render to do it where the change happens:

```ts
function handleQueryChange(value: string) {
  setQuery(value);
  setPage(1);
}
```

Rule of thumb from the React docs: if something happens *because the user did
something*, put it in the event handler. Effects are for synchronising with
systems outside React (the network, timers, `localStorage`).

### A generic hook: `useLocalStorage<T>`

```ts
export function useLocalStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {           // lazy initial state: read once
    const stored = localStorage.getItem(key);
    return stored === null ? initialValue : (JSON.parse(stored) as T);
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));      // write on every change
  }, [key, value]);

  return [value, setValue];
}
```

Its return type is exactly that of `useState`, so callers use it the same way,
including updater functions (`setFavorites(prev => …)`). The type parameter
makes it work for any JSON-serialisable value.

### Pagination

Open Library pages with `page` and `limit` parameters and reports the total
number of matches (`numFound`). Sorting is done **by the API** (`sort=new` /
`sort=old`), because sorting one page on the client would only reorder 24 of
thousands of results.

```tsx
<Pagination count={pageCount} page={page} onChange={(_e, value) => handlePageChange(value)} />
```

`MAX_PAGES` caps the pager at 50 pages: deep pages are slow to compute on the
server and nobody reads them.

### Performance: `memo`, `useCallback` and `useMemo`

When `App` re-renders (for example on every keystroke in the search box), all
its children re-render too, by default. Usually that is fine, since React is
fast. With a grid of cards it is worth understanding how to avoid it:

```tsx
export default memo(BookCard);   // skip re-rendering if all props are ===
```

`memo` compares props with `===`. Numbers and strings compare by value, but a
**function created during render is a new object every time**, so this alone
does nothing:

```tsx
// a new function on every render → memo sees a "changed" prop → re-renders anyway
const toggleFavorite = (book: Book) => setFavorites(…);
```

`useCallback` returns the same function instance until its dependencies
change:

```tsx
const toggleFavorite = useCallback((book: Book) => {
  setFavorites((prev) => …);       // updater form: no need to depend on `favorites`
}, [setFavorites]);                // setState functions are stable
```

Now toggling a favourite re-renders only the card whose `isFavorite` changed.
`useMemo` does the same for computed values (`favoriteKeys`, `visibleBooks`):
the Set is rebuilt only when `favorites` changes, and it is the same object
otherwise.

Use these tools when there is a reason: a long list, an expensive
calculation, or a prop passed to a memoised component. To see the effect, open
React DevTools → *Profiler* → enable "Highlight updates when components
render", and toggle a favourite with and without `useCallback`.

> The React Compiler (a separate build plugin) can insert this memoisation
> automatically. Bun's bundler does not run it, so in this course we memoise by
> hand, which is also the best way to understand what the compiler does.

### Lint rules for hooks

The repository's ESLint config enables `eslint-plugin-react-hooks`, which
checks the rules of hooks, dependency arrays (`exhaustive-deps`), and the
newer React Compiler rules (`set-state-in-effect`, `purity`, `refs`, …). Run
`bun run lint` at the repository root. A missing dependency in an effect is one
of the most common React bugs, and the linter finds it.

## Lecture walkthrough

1. `types.ts` and `api.ts`: map Open Library's documents to `Book`, ask only
   for the needed `fields`.
2. `useLocalStorage<T>`: lazy initial state + an effect that writes.
3. `useDebouncedValue`: show the request count in the Network tab with and
   without it.
4. `useBookSearch`: first the naïve version (setLoading in the effect), show
   the lint error and a race condition (throttle the network in DevTools), then
   the abort + derived-loading version.
5. Presentational components: `SearchBar`, `ControlsBar`, `BookCard`,
   `BookGrid`, `FavoritesPanel`.
6. `App.tsx`: compose the hooks, page reset in the handlers, `useMemo` for
   derived data, `useCallback` + `memo`, `Pagination`.
7. Profile with React DevTools.

## Compared with last year's Vite + Deno version

- New from the course plan: pagination, plus server-side sorting so that
  sorting and paging work together.
- Debouncing is its own reusable hook; `useBookSearch` derives `loading` from
  the request key instead of setting it inside the effect (required by the
  current `eslint-plugin-react-hooks`).
- `memo` + `useCallback` added to show referential equality in practice.
- MUI 9: layout props on `Stack` move into `sx`.

## Exercises

1. Extract a generic `useFetch<T>(url)` from `useBookSearch` that any component
   can use: `const { data, loading, error } = useFetch<Book[]>(url)`.
2. Put the query and page in the URL (`?q=dune&page=2`) so searches can be
   shared and the back button works. (`URLSearchParams`, `history.pushState`,
   and the `popstate` event, or React Router's `useSearchParams`.)
3. Add a details dialog: clicking a card fetches
   `https://openlibrary.org${book.key}.json` and shows the description. Cancel
   the request if the dialog closes early.
4. Replace the pager with infinite scrolling using `IntersectionObserver` in a
   custom `useInView` hook.

## Further reading

- [react.dev: Reusing logic with custom hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [react.dev: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [react.dev: memo](https://react.dev/reference/react/memo), [useCallback](https://react.dev/reference/react/useCallback), [useMemo](https://react.dev/reference/react/useMemo)
- [react.dev: ESLint plugin for React hooks](https://react.dev/reference/eslint-plugin-react-hooks)
- [Open Library Search API](https://openlibrary.org/dev/docs/api/search)
