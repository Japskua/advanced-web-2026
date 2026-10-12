# Image Gallery v2 client (week 6)

Week 5's client plus deleting images.

**Lecture notes:** [week-06/README.md](../README.md) explains every concept in this project step by step.

## Run it

```bash
bun install
bun run dev
```

Runs at http://localhost:5173.

This is one half of a full-stack app; start the other half too: [`image-gallery-v2-api`](../image-gallery-v2-api).

## Scripts

| Command | What it does |
| ------- | ------------ |
| `bun run dev` | Dev server with hot reload |
| `bun run build` | Production build into `dist/` |
| `bun run typecheck` | Type-check with `tsc` (Bun runs TypeScript but never checks it) |

## Notes

- Types shared with the other half of the app live in [`week-06/shared/`](../shared) and are imported as `@shared/…` (a path alias in `tsconfig.json`). When copying this project elsewhere, copy `shared/` next to it.
