# Encrypted File Vault client (week 12)

Generates an AES-GCM key in the browser, encrypts before uploading and decrypts after downloading (Web Crypto). The build is plain static files; in production Caddy serves them.

**Lecture notes:** [week-12/README.md](../README.md) explains every concept in this project step by step.

## Run it

```bash
bun install
cp .env.example .env        # or `bun run setup:env` in the repository root
bun run dev
```

Runs at http://localhost:5173.

This is one half of a full-stack app; start the other half too: [`encrypted-file-vault-api`](../encrypted-file-vault-api).

## Scripts

| Command | What it does |
| ------- | ------------ |
| `bun run dev` | Dev server with hot reload |
| `bun run build` | Production build into `dist/` |
| `bun run typecheck` | Type-check with `tsc` (Bun runs TypeScript but never checks it) |

## Configuration

Bun loads `.env` automatically. `.env.example` contains working values for local development:

| Variable | Purpose |
| -------- | ------- |
| `BUN_PUBLIC_API_URL` | The API's URL, written into the bundle at build time (public, never a secret) |

`.env` is git-ignored: never commit real secrets.

## Notes

- `BUN_PUBLIC_API_URL` is written into the bundle at build time: `BUN_PUBLIC_API_URL=https://… bun run build`. [`week-12/deploy/prepare.ts`](../deploy/prepare.ts) does this for you.
- Web Crypto only works in a secure context: `http://localhost` or HTTPS. That is why the deployment uses HTTPS from the start.
- Types shared with the other half of the app live in [`week-12/shared/`](../shared) and are imported as `@shared/…` (a path alias in `tsconfig.json`). When copying this project elsewhere, copy `shared/` next to it.
