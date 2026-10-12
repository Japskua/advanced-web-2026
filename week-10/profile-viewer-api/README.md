# Profile Viewer API (week 10)

Sign-in with Google through OpenID Connect (authorization code + PKCE, `openid-client`) and a server-side session in an `HttpOnly` cookie.

**Lecture notes:** [week-10/README.md](../README.md) explains every concept in this project step by step.

## Run it

```bash
bun install
cp .env.example .env        # or `bun run setup:env` in the repository root
bun run dev
```

Runs at http://localhost:8000.

This is one half of a full-stack app; start the other half too: [`profile-viewer-client`](../profile-viewer-client).

## Scripts

| Command | What it does |
| ------- | ------------ |
| `bun run dev` | Start the API, restarting on every save |
| `bun run start` | Start the API without watching |
| `bun run mock-oidc` | Start the mock OpenID provider on http://localhost:9000 |
| `bun run typecheck` | Type-check with `tsc` (Bun runs TypeScript but never checks it) |
| `bun run test` | Run the tests (`bun test`) – 10 tests |

## Configuration

Bun loads `.env` automatically. `.env.example` contains working values for local development:

| Variable | Purpose |
| -------- | ------- |
| `BASE_URL` | Where this API runs; the OAuth redirect URI is built from it |
| `FRONTEND_URL` | Where the client runs: redirects after login and the allowed CORS origin |
| `GOOGLE_CLIENT_ID` | OAuth client id from Google Cloud Console (any value works with the mock provider) |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret from Google Cloud Console (any value works with the mock provider) |
| `OIDC_ISSUER` | Optional: another OpenID provider instead of Google, e.g. the mock at `http://localhost:9000` |

`.env` is git-ignored: never commit real secrets.

## Notes

- Without a Google Cloud project, run `bun run mock-oidc` (a local OpenID provider on port 9000) and set `OIDC_ISSUER=http://localhost:9000` in `.env`.
- The tests start their own mock provider and need no configuration.
- Types shared with the other half of the app live in [`week-10/shared/`](../shared) and are imported as `@shared/…` (a path alias in `tsconfig.json`). When copying this project elsewhere, copy `shared/` next to it.
