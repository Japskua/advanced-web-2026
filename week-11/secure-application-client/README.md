# Security demo console (week 11)

One UI that sends the demo attacks to either API (vulnerable or secure) and shows the raw responses. `CORS-test.html` plays a malicious page on another origin.

**Lecture notes:** [week-11/README.md](../README.md) explains every concept in this project step by step.

## Run it

```bash
bun install
bun run dev
```

Runs at http://localhost:5173 (console) and http://localhost:5500 (`bun run cors-test`).

This is one half of a full-stack app; start the other half too: [`secure-application-api`](../secure-application-api).

## Scripts

| Command | What it does |
| ------- | ------------ |
| `bun run dev` | Dev server with hot reload |
| `bun run cors-test` | Serve `CORS-test.html` on another origin (port 5500) |
| `bun run build` | Production build into `dist/` |
| `bun run typecheck` | Type-check with `tsc` (Bun runs TypeScript but never checks it) |
