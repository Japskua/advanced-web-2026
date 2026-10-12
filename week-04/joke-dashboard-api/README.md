# Joke Dashboard API (week 4)

Fetches programming jokes from JokeAPI through a service module (with a timeout and `502`/`504` errors) and keeps saved jokes in memory. Sends CORS headers for the client.

**Lecture notes:** [week-04/README.md](../README.md) explains every concept in this project step by step.

## Run it

```bash
bun install
bun run dev
```

Runs at http://localhost:8000.

This is one half of a full-stack app; start the other half too: [`joke-dashboard-client`](../joke-dashboard-client).

## Scripts

| Command | What it does |
| ------- | ------------ |
| `bun run dev` | Start the API, restarting on every save |
| `bun run start` | Start the API without watching |
| `bun run typecheck` | Type-check with `tsc` (Bun runs TypeScript but never checks it) |
| `bun run test` | Run the tests (`bun test`) – 11 tests |

## Notes

- Types shared with the other half of the app live in [`week-04/shared/`](../shared) and are imported as `@shared/…` (a path alias in `tsconfig.json`). When copying this project elsewhere, copy `shared/` next to it.
