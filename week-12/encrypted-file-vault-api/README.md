# Encrypted File Vault API (week 12)

Stores files that were encrypted in the browser: ciphertext in Azure Blob Storage (Azurite locally), metadata in PostgreSQL. Rate-limited login, health endpoint, Docker image.

**Lecture notes:** [week-12/README.md](../README.md) explains every concept in this project step by step.

## Run it

```bash
docker compose up -d        # in the repository root: PostgreSQL + Azurite
bun install
cp .env.example .env        # or `bun run setup:env` in the repository root
bun run db:setup
bun run dev
```

Runs at http://localhost:8000.

This is one half of a full-stack app; start the other half too: [`encrypted-file-vault-client`](../encrypted-file-vault-client).

## Scripts

| Command | What it does |
| ------- | ------------ |
| `bun run dev` | Start the API, restarting on every save |
| `bun run start` | Start the API without watching |
| `bun run build` | Bundle the API and its dependencies into `dist/main.js` |
| `bun run db:setup` | Create the database tables from `sql/` |
| `bun run typecheck` | Type-check with `tsc` (Bun runs TypeScript but never checks it) |
| `bun run test` | Run the tests (`bun test`) – 13 tests |

## Configuration

Bun loads `.env` automatically. `.env.example` contains working values for local development:

| Variable | Purpose |
| -------- | ------- |
| `PORT` | Port the API listens on (default 8000) |
| `DATABASE_URL` | PostgreSQL connection string; the default points at this week's database in the Docker container |
| `JWT_SECRET` | Key that signs the JWTs: long and random, never the placeholder (`bun run setup:env` generates one) |
| `INVITE_CODE` | Code required to register, so strangers cannot sign up |
| `ALLOWED_ORIGIN` | The one origin allowed by CORS: the client's URL |
| `TRUST_PROXY` | `true` only behind a proxy that sets `X-Forwarded-For` (Azure Container Apps); used by the login rate limit |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob storage: `UseDevelopmentStorage=true` for Azurite, the storage account's connection string in Azure |
| `AZURE_STORAGE_CONTAINER_NAME` | Blob container for the encrypted files (created at startup) |

`.env` is git-ignored: never commit real secrets.

## Notes

- Container image: `bun run build` then `docker build -t vault-api .` (see the Dockerfile and the week README).
- The week README has the step-by-step Azure deployment.
- Types shared with the other half of the app live in [`week-12/shared/`](../shared) and are imported as `@shared/…` (a path alias in `tsconfig.json`). When copying this project elsewhere, copy `shared/` next to it.
