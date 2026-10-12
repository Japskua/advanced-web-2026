# Secret Notes API (week 7)

Registration and login with `Bun.password` (Argon2id) and JWTs (`jose`); `GET /api/notes` only for authenticated users.

**Lecture notes:** [week-07/README.md](../README.md) explains every concept in this project step by step.

## Run it

```bash
docker compose up -d        # in the repository root: PostgreSQL
bun install
cp .env.example .env        # or `bun run setup:env` in the repository root
bun run db:setup
bun run dev
```

Runs at http://localhost:8000.

This is one half of a full-stack app; start the other half too: [`secret-notes-client`](../secret-notes-client).

## Scripts

| Command | What it does |
| ------- | ------------ |
| `bun run dev` | Start the API, restarting on every save |
| `bun run start` | Start the API without watching |
| `bun run db:setup` | Create the database tables from `sql/` |
| `bun run typecheck` | Type-check with `tsc` (Bun runs TypeScript but never checks it) |
| `bun run test` | Run the tests (`bun test`) – 13 tests |

## Configuration

Bun loads `.env` automatically. `.env.example` contains working values for local development:

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | PostgreSQL connection string; the default points at this week's database in the Docker container |
| `JWT_SECRET` | Key that signs the JWTs: long and random, never the placeholder (`bun run setup:env` generates one) |

`.env` is git-ignored: never commit real secrets.

## Notes

- Types shared with the other half of the app live in [`week-07/shared/`](../shared) and are imported as `@shared/…` (a path alias in `tsconfig.json`). When copying this project elsewhere, copy `shared/` next to it.
