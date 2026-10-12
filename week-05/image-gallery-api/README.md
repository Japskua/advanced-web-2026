# Image Gallery API (week 5)

Multipart image uploads stored on disk (`uploads/`) with metadata in a JSON file (`data/uploads.json`). Checks size, type and magic bytes; logs every request through middleware.

**Lecture notes:** [week-05/README.md](../README.md) explains every concept in this project step by step.

## Run it

```bash
bun install
bun run dev
```

Runs at http://localhost:8000.

This is one half of a full-stack app; start the other half too: [`image-gallery-client`](../image-gallery-client).

## Scripts

| Command | What it does |
| ------- | ------------ |
| `bun run dev` | Start the API, restarting on every save |
| `bun run start` | Start the API without watching |
| `bun run typecheck` | Type-check with `tsc` (Bun runs TypeScript but never checks it) |
| `bun run test` | Run the tests (`bun test`) – 12 tests |

## Notes

- Types shared with the other half of the app live in [`week-05/shared/`](../shared) and are imported as `@shared/…` (a path alias in `tsconfig.json`). When copying this project elsewhere, copy `shared/` next to it.
