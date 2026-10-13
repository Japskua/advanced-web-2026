# Encrypted File Vault API (week 12)

Stores files that were encrypted in the browser: ciphertext in S3-compatible object storage (SeaweedFS locally, through Bun's built-in `S3Client`), metadata in PostgreSQL. Rate-limited login, health endpoint, Docker image.

**Lecture notes:** [week-12/README.md](../README.md) explains every concept in this project step by step.

## Run it

```bash
docker compose up -d        # in the repository root: PostgreSQL + SeaweedFS
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
| `TRUST_PROXY` | `true` only behind a reverse proxy that sets `X-Forwarded-For` (Caddy in production); used by the login rate limit |
| `S3_ENDPOINT` | Object storage endpoint: `http://localhost:8333` for SeaweedFS, e.g. `https://fsn1.your-objectstorage.com` (Hetzner) or `https://fra1.digitaloceanspaces.com` (DigitalOcean) |
| `S3_BUCKET` | Bucket for the encrypted files (must already exist; checked at startup) |
| `S3_ACCESS_KEY_ID` | Object storage access key (the local value matches `docker-compose.yml`) |
| `S3_SECRET_ACCESS_KEY` | Object storage secret key |
| `S3_REGION` | Region used for request signing: `us-east-1` for SeaweedFS and DigitalOcean Spaces, the location (e.g. `fsn1`) for Hetzner |
| `S3_VIRTUAL_HOSTED_STYLE` | `true` puts the bucket in the host name (`bucket.host/key`) instead of the path (`host/bucket/key`); Hetzner and DigitalOcean document this style |

`.env` is git-ignored: never commit real secrets.

## Notes

- Container image: `bun run build` then `docker build -t vault-api .` (see the Dockerfile). You rarely do this by hand: [`week-12/deploy/prepare.ts`](../deploy/prepare.ts) assembles the deployment and the server builds the image.
- The week README walks through deploying the whole app to one Hetzner or DigitalOcean server (Docker Compose + Caddy for HTTPS).
- Types shared with the other half of the app live in [`week-12/shared/`](../shared) and are imported as `@shared/…` (a path alias in `tsconfig.json`). When copying this project elsewhere, copy `shared/` next to it.
