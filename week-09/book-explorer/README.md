# Book Explorer (week 9)

Searches the Open Library API as you type: custom hooks (`useDebouncedValue`, `useBookSearch`, `useLocalStorage`), cancellation, pagination and `memo`/`useCallback`. Front-end only, built with shadcn/ui and Tailwind CSS.

**Lecture notes:** [week-09/README.md](../README.md) explains every concept in this project step by step.

## Run it

```bash
bun install
bun run dev
```

Runs at http://localhost:5173.

## Scripts

| Command | What it does |
| ------- | ------------ |
| `bun run dev` | Dev server with hot reload |
| `bun run build` | Production build into `dist/` (`build.ts`: `Bun.build()` with the Tailwind plugin) |
| `bun run typecheck` | Type-check with `tsc` (Bun runs TypeScript but never checks it) |

## Notes

- shadcn/ui components live in `src/components/ui/`. Add more with `bunx shadcn@latest add <name>` (settings in `components.json`). The theme (colours, radius) is the CSS variables in `src/index.css`. The setup is explained in [week 8](../../week-08/README.md#shadcnui-and-tailwind-css).
