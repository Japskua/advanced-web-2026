# Image Gallery v2 API (week 6)

Week 5's API with the metadata moved to PostgreSQL through Bun's built-in SQL client, a repository layer, and a delete endpoint.

**Lecture notes:** [week-06/README.md](../README.md) explains every concept in this project step by step.

## Run it

```bash
docker compose up -d        # in the repository root: PostgreSQL
bun install
cp .env.example .env        # or `bun run setup:env` in the repository root
bun run db:setup
bun run dev
```

Runs at http://localhost:8000.

This is one half of a full-stack app; start the other half too: [`image-gallery-v2-client`](../image-gallery-v2-client).

## Scripts

| Command | What it does |
| ------- | ------------ |
| `bun run dev` | Start the API, restarting on every save |
| `bun run start` | Start the API without watching |
| `bun run db:setup` | Create the database tables from `sql/` |
| `bun run typecheck` | Type-check with `tsc` (Bun runs TypeScript but never checks it) |
| `bun run test` | Run the tests (`bun test`) – 7 tests |

## Configuration

Bun loads `.env` automatically. `.env.example` contains working values for local development:

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | PostgreSQL connection string; the default points at this week's database in the Docker container |

`.env` is git-ignored: never commit real secrets.

## Notes

- Types shared with the other half of the app live in [`week-06/shared/`](../shared) and are imported as `@shared/…` (a path alias in `tsconfig.json`). When copying this project elsewhere, copy `shared/` next to it.
