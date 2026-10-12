# Image Gallery client (week 5)

Upload form (`FormData`) and a gallery grid. Validates files with the same rules as the API (`shared/upload-rules.ts`).

**Lecture notes:** [week-05/README.md](../README.md) explains every concept in this project step by step.

## Run it

```bash
bun install
bun run dev
```

Runs at http://localhost:5173.

This is one half of a full-stack app; start the other half too: [`image-gallery-api`](../image-gallery-api).

## Scripts

| Command | What it does |
| ------- | ------------ |
| `bun run dev` | Dev server with hot reload |
| `bun run build` | Production build into `dist/` |
| `bun run typecheck` | Type-check with `tsc` (Bun runs TypeScript but never checks it) |

## Notes

- Types shared with the other half of the app live in [`week-05/shared/`](../shared) and are imported as `@shared/…` (a path alias in `tsconfig.json`). When copying this project elsewhere, copy `shared/` next to it.
