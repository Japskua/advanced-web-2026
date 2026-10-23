# Community Notice Board API (week 8)

An Elysia API with the complete layered architecture (routes → services → repositories), DTOs vs. entities, `AppError` with a central `onError` handler, input schemas, and role-based access control (the `auth` and `role` macros).

**Lecture notes:** [week-08/README.md](../README.md) explains every concept in this project step by step.

## Run it

```bash
docker compose up -d        # in the repository root: PostgreSQL
bun install
cp .env.example .env        # or `bun run setup:env` in the repository root
bun run db:setup
bun run seed:admin
bun run dev
```

Runs at http://localhost:8000.

This is one half of a full-stack app; start the other half too: [`community-notice-board-client`](../community-notice-board-client).

## Scripts

| Command | What it does |
| ------- | ------------ |
| `bun run dev` | Start the API, restarting on every save |
| `bun run start` | Start the API without watching |
| `bun run db:setup` | Create the database tables from `sql/` |
| `bun run seed:admin` | Create the first administrator |
| `bun run typecheck` | Type-check with `tsc` (Bun runs TypeScript but never checks it) |
| `bun run test` | Run the tests (`bun test`) – 15 tests |

## Configuration

Bun loads `.env` automatically. `.env.example` contains working values for local development:

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | PostgreSQL connection string; the default points at this week's database in the Docker container |
| `JWT_SECRET` | Key that signs the JWTs: long and random, never the placeholder (`bun run setup:env` generates one) |
| `ADMIN_EMAIL` | Email of the first administrator, created by `bun run seed:admin` |
| `ADMIN_PASSWORD` | That administrator's password (must satisfy the password policy) |

`.env` is git-ignored: never commit real secrets.

## Notes

- Create the first administrator with `bun run seed:admin` (uses `ADMIN_EMAIL` and `ADMIN_PASSWORD`).
- Types shared with the other half of the app live in [`week-08/shared/`](../shared) and are imported as `@shared/…` (a path alias in `tsconfig.json`). When copying this project elsewhere, copy `shared/` next to it.
