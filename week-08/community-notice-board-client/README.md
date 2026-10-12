# Community Notice Board client (week 8)

Material UI client with role-aware navigation, admin pages (publish notifications, manage users) and login state through `useSyncExternalStore`.

**Lecture notes:** [week-08/README.md](../README.md) explains every concept in this project step by step.

## Run it

```bash
bun install
bun run dev
```

Runs at http://localhost:5173.

This is one half of a full-stack app; start the other half too: [`community-notice-board-api`](../community-notice-board-api).

## Scripts

| Command | What it does |
| ------- | ------------ |
| `bun run dev` | Dev server with hot reload |
| `bun run build` | Production build into `dist/` |
| `bun run typecheck` | Type-check with `tsc` (Bun runs TypeScript but never checks it) |

## Notes

- Types shared with the other half of the app live in [`week-08/shared/`](../shared) and are imported as `@shared/…` (a path alias in `tsconfig.json`). When copying this project elsewhere, copy `shared/` next to it.
