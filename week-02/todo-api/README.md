# Todo REST API with a static front-end (week 2)

Full CRUD for tasks with Bun's `routes` table, request validation and a discriminated-union response envelope. The same server serves a plain HTML/CSS/JavaScript front-end from `public/`.

**Lecture notes:** [week-02/README.md](../README.md) explains every concept in this project step by step.

## Run it

```bash
bun install
bun run dev
```

Runs at http://localhost:8000 (front-end) and http://localhost:8000/api/tasks.

## Scripts

| Command | What it does |
| ------- | ------------ |
| `bun run dev` | Start the API, restarting on every save |
| `bun run start` | Start the API without watching |
| `bun run typecheck` | Type-check with `tsc` (Bun runs TypeScript but never checks it) |
| `bun run test` | Run the tests (`bun test`) – 21 tests |
