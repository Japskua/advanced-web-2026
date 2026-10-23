# Secure Application API (week 11)

An OWASP Top 10 demo in two versions with the same endpoints: `src/vulnerable/` (port 8000) and `src/secure/` (port 8001). Both can run at the same time against separate databases.

**Lecture notes:** [week-11/README.md](../README.md) explains every concept in this project step by step.

## Run it

```bash
docker compose up -d        # in the repository root: PostgreSQL
bun install
bun run setup:env           # in the repository root: .env with a random JWT_SECRET
                            # (or cp .env.example .env, then replace JWT_SECRET yourself)
bun run db:setup
bun run dev:vulnerable      # and, in another terminal: bun run dev:secure
```

Runs at http://localhost:8000 (vulnerable) and http://localhost:8001 (secure).

This is one half of a full-stack app; start the other half too: [`secure-application-client`](../secure-application-client).

## Scripts

| Command | What it does |
| ------- | ------------ |
| `bun run dev:vulnerable` | Start the vulnerable version on port 8000 |
| `bun run dev:secure` | Start the secure version on port 8001 |
| `bun run db:setup` | Create the database tables from `sql/` |
| `bun run typecheck` | Type-check with `tsc` (Bun runs TypeScript but never checks it) |
| `bun run test` | Run the tests (`bun test`) – 27 tests |

## Configuration

Bun loads `.env` automatically. `.env.example` contains working values for local development, except `JWT_SECRET`:
both versions refuse to start while it is the placeholder.

| Variable | Purpose |
| -------- | ------- |
| `VULNERABLE_DATABASE_URL` | Database of the vulnerable version |
| `SECURE_DATABASE_URL` | Database of the secure version |
| `JWT_SECRET` | Key that signs the JWTs: long and random, never the placeholder (`bun run setup:env` generates one) |
| `ALLOWED_ORIGIN` | The one origin allowed by CORS: the client's URL |

`.env` is git-ignored: never commit real secrets.

## Notes

- `bun run db:setup` resets both demo databases; run it again after a demonstration deleted users.
- ⚠️ Never deploy the vulnerable version.
- Compare the versions: `git diff --no-index src/vulnerable/app.ts src/secure/app.ts`.
