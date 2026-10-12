# Todo API (week 1)

The smallest possible JSON API: `GET /tasks` returns a hard-coded task list. Introduces `Bun.serve`, TypeScript types, interfaces and generics.

**Lecture notes:** [week-01/README.md](../README.md) explains every concept in this project step by step.

## Run it

```bash
bun install
bun run dev
```

Runs at http://localhost:8000/tasks.

## Scripts

| Command | What it does |
| ------- | ------------ |
| `bun run dev` | Start the API, restarting on every save |
| `bun run start` | Start the API without watching |
| `bun run tour` | Run the TypeScript tour |
| `bun run typecheck` | Type-check with `tsc` (Bun runs TypeScript but never checks it) |
| `bun run test` | Run the tests (`bun test`) – 3 tests |

## Notes

- `examples/typescript-tour.ts` is a runnable tour of every TypeScript feature used in the course (`bun run tour`).
