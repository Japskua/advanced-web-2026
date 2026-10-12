# Implementation plan: porting Advanced Web Applications 2026 from Deno to Bun

This document records how the 2026 course material
([eclap5/Advanced-Web-Applications-2026](https://github.com/eclap5/Advanced-Web-Applications-2026))
was analysed and re-implemented on [Bun](https://bun.sh). It is written for
the teaching staff: it explains *what* was ported, *which* decisions were made
and *why*, and which upstream problems were fixed along the way.

Student-facing material lives in each `week-XX/README.md`.

> **Status:** all twelve weeks are implemented. All 20 projects type-check, the
> 132 API tests pass, every client builds, ESLint is clean, and every
> application was exercised end to end in a browser (see §8).

---

## 1. Goals

1. Re-implement every lecture project from the Deno repository on Bun, keeping
   the same applications, the same weekly topics and the same learning
   progression, so existing slides and exercises stay valid.
2. Use Bun idiomatically, not as "Deno with different flags". Where Bun ships a
   built-in (SQL client, password hashing, cookies, bundler, test runner), use it
   and teach it.
3. One toolchain for the whole course: no Vite, no Node.js, no Deno.
4. Write documentation that a student can follow alone after the lecture, and a
   lecturer can teach from.
5. Fix the bugs and inconsistencies found in the upstream code, and make every
   week verifiable with `bun test` and `tsc`.

## 2. What the upstream repository contains

| Week | Upstream project(s) | Size | Stack |
| ---- | ------------------- | ---- | ----- |
| 1 | Todo API (single GET) | ~90 lines | `Deno.serve` |
| 2 | Todo REST API + static HTML/JS/CSS | ~500 | `Deno.serve`, `Deno.readFile` |
| 3 | Habit Tracker (React only) | ~430 | Vite + React |
| 4 | Joke Dashboard API + client | ~830 | external API, in-memory store, CORS |
| 5 | Image Gallery API + client | ~790 | multipart upload, filesystem, JSON "database", logging middleware |
| 6 | Image Gallery v2 API + client | ~1030 | PostgreSQL via `jsr:@db/postgres`, repository layer |
| 7 | Secret Notes API + client | ~1060 | JWT (`jose`), bcrypt (`jsr:@felix/bcrypt`), React Router |
| 8 | Community Notice Board API + client | ~1790 | layered architecture, RBAC, Material UI |
| 9 | Book Explorer (React only) | ~830 | custom hooks, Open Library API, MUI |
| 10 | Profile Viewer API + client | ~1030 | Google OIDC + PKCE (`openid-client`), cookie sessions, i18n |
| 11 | Secure Application API + client | ~1120 | intentionally vulnerable OWASP demo |
| 12 | Encrypted File Vault API + client | ~3560 | Web Crypto, Azure Blob Storage, Docker, Azure deployment |

The two plan tables shared with the port (the original *plan* and the final
*implementation* table) differ slightly. This port follows the
**implementation** table, and adds two items from the plan that were dropped
upstream: pagination (week 9) and rate limiting (week 11). The plan's
"Deno permission model" topic (week 11) becomes a supply-chain security topic,
because Bun has no runtime permission sandbox (see §6).

## 3. Key decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Back-end HTTP server | `Bun.serve` with the declarative `routes` table (week 1 starts with the bare `fetch` handler) | Built in, typed route params (`req.params.id`), per-method handlers. No framework needed, so students still see the raw `Request`/`Response` model. |
| Front-end tooling | **Bun-native**: HTML imports, `bun ./index.html` dev server, `bun build` | One tool for runtime, packages, bundling and tests. One `tsconfig.json` instead of three, no `vite.config.ts`. Verified: HMR, SPA fallback for React Router, `BUN_PUBLIC_*` env inlining, MUI and i18next bundling. |
| Database driver | Bun's built-in `SQL` (`import { SQL } from "bun"`) | Removes `jsr:@db/postgres`. Tagged templates are parameterised by construction, which ties directly into the week 11 injection lecture. |
| Password hashing | `Bun.password` (argon2id by default, bcrypt available) | Removes `jsr:@felix/bcrypt`. |
| Cookies | `req.cookies` (`Bun.CookieMap`) | Replaces the hand-written cookie parser in week 10. |
| JWT | `jose` (npm) | Bun has no JWT built-in; `jose` is the standard. |
| OIDC | `openid-client` v6 (npm) | Same library as upstream (`jsr:@panva/openid-client` is the same package). |
| Blob storage | `@azure/storage-blob` (npm) + **Azurite** emulator locally | Verified working on Bun. Azurite lets week 12 run without an Azure account. |
| Env vars | Bun auto-loads `.env`; every API validates its env in one `config.ts` from week 7 | No `--env-file` flag needed. Failing fast on a missing `JWT_SECRET` fixes an upstream bug. |
| Repository layout | Bun **workspaces**, one folder per project: `week-XX/<project>/` | One `bun install` at the root installs every week. Each project still has its own complete `package.json`/`tsconfig.json`, so a student can copy one folder out and run `bun install`. Week folders are zero-padded so they sort correctly. |
| API response envelope | `{ ok: true, data }` / `{ ok: false, error: { message } }` everywhere from week 2 (except week 11's demo API, which shows raw answers on purpose) | Upstream mixed four shapes and several clients read the wrong one (see §5). Week 1 keeps a simpler shape on purpose and week 2 explains why the union is better. |
| Shared types | `week-XX/shared/types.ts`, imported with `import type` by both API and client | Makes the plan's "shared TypeScript types" concrete. From week 8 it is also where DTOs live, while entities stay inside the API. |
| Error handling | Week 2–5: status codes chosen in handlers. Week 6–7: plus a generic `500` from `Bun.serve`'s `error` hook. Week 8+: `AppError` subclasses mapped to responses by that hook | Shows the progression from ad-hoc to structured error handling. |
| Week 11 | Side-by-side `src/vulnerable/` and `src/secure/`, chosen by `SECURITY_MODE`; both can run at once (ports 8000 and 8001) | Students can diff the two files, the lecturer can flip one UI between them, and tests prove each fix. |
| Type checking | `typescript` 6.0 (`tsc --noEmit`) in every project | Bun strips types but never checks them. TS 7 is out, but `typescript-eslint` does not support it yet. |
| Linting | One ESLint 10 flat config at the repository root, with `react-hooks` rules | Keeps per-project folders small; the hooks rules reinforce the `useEffect` lectures. |
| Tests | `bun test` in every back-end, plus pure-logic tests where useful | Verifies the port, and doubles as a reference for CodeGrade-style automatic grading. |
| Ports | APIs on `8000`, clients on `5173` | Same as upstream, so the GCP and Azure instructions (redirect URIs, allowed origins) are unchanged. |
| Dependencies | Latest stable majors (React 19.3, React Router 8, MUI 9, i18next 26) | Verified to typecheck and bundle with Bun 1.4.2 before adoption. |
| Install policy | Root `bunfig.toml`: `minimumReleaseAge = 259200` (3 days) | Supply-chain hygiene taught in week 11. It immediately blocked `@types/bun@1.4.3` (published that day), so version floors were set to releases older than three days (`@types/bun ^1.4.2`, `@mui/material ^9.4.0`, `i18next ^26.4.2`). |
| Week 10 testing | A small mock OpenID provider (`dev/mock-oidc-provider.ts`) | The whole OIDC flow (state, nonce, PKCE, signed ID tokens) is tested automatically and can be developed without a Google Cloud project. |
| Week 12 image | `bun build` bundles the API and its dependencies into one file; the image is `oven/bun:1.4-alpine` + that file, running as the `bun` user | No `node_modules` or lockfile juggling inside Docker (the workspace lockfile lives at the repository root). |

## 4. Week-by-week port

Each entry lists what stays the same, what Bun changes, and what was fixed or
added. "Bun feature" is what the week can show off about the toolchain.

### Week 1 – TypeScript & Bun introduction (`week-01/todo-api`)
- Same: `Task` type/interface, union `TaskStatus`, generic `ApiResponse<T>`,
  single `GET /tasks`.
- Bun: `bun init`, `Bun.serve({ fetch })`, `bun --watch`, running TypeScript
  directly, `tsc --noEmit` for type checking, `import.meta.main`.
- Added: a first `bun test` file that calls the handler without opening a port.

### Week 2 – REST API (`week-02/todo-api`)
- Same: full CRUD on tasks, plain HTML/JS/CSS front-end served by the API.
- Bun: `routes` table with `:id` params and per-method handlers; `Bun.file` for
  static files (content type detected automatically).
- Fixed: ids like `1.5` or `-3` are rejected with 400; malformed JSON gives 400;
  unknown API routes give a JSON 404; path traversal is blocked explicitly.
- Changed: `PUT` replaces the editable fields of a task (correct REST
  semantics); the docs discuss `PATCH`.
- Added: the `ApiResult<T>` discriminated union and why it beats week 1's
  optional-field shape.

### Week 3 – React (`week-03/habit-tracker`)
- Same: components, props, state, immutable updates, optional `useMemo`
  progress bar.
- Bun: project created with `bun init` + `bun add react react-dom`, served by
  `bun ./index.html` (HMR included), built by `bun build`.

### Week 4 – Full-stack data flow (`week-04/joke-dashboard-*`)
- Same: back-end proxies JokeAPI, stores saved jokes in memory; client polls,
  saves and lists.
- Fixed: client and API disagreed on the error shape (`error` string vs
  `error.message`), on the id field (`id` vs `externalId`) and on the timestamp
  (`fetchedAt` vs `savedAt`, which rendered "Invalid Date"). Both now import the
  same `shared/types.ts`.
- Improved: an upstream failure returns `502 Bad Gateway` instead of 500; a
  generic `request<T>()` helper replaces three copies of the same fetch code.
- Added: tests that mock the external API with `spyOn(globalThis, "fetch")`.

### Week 5 – File system & multipart upload (`week-05/image-gallery-*`)
- Same: multipart upload, files on disk, metadata in `data/uploads.json`,
  logging middleware, gallery client.
- Bun: `req.formData()`, `Bun.write`, `Bun.file`, and a middleware helper that
  wraps every handler in the `routes` table.
- Fixed/added: upload size limit, MIME allowlist, uniform JSON errors.
  The docs point out the read-modify-write race on the JSON file, which
  motivates week 6.

### Week 6 – SQL database (`week-06/image-gallery-v2-*`)
- Same: PostgreSQL metadata, repository layer, delete feature.
- Bun: built-in `SQL` client, tagged-template parameters, `sql.file()` for the
  schema, `.env` loaded automatically.
- Fixed: malformed UUIDs are rejected with 400 before reaching the database
  (upstream leaked the raw database error); the connection string comes from
  `.env` instead of source code.
- Added: `bun run db:setup` applies `sql/schema.sql` with no `psql` needed;
  `docker compose` provides PostgreSQL.

### Week 7 – Authentication (`week-07/secret-notes-*`)
- Same: register/login, JWT in `localStorage`, protected notes, React Router.
- Bun: `Bun.password.hash/verify`; no `--allow-*` or `--env-file` flags.
- Fixed: registration validates its body (upstream crashed with 500 on a missing
  field); the unique-violation check uses the real Postgres error code
  (`errno === "23505"`; upstream compared the *message* to `"23505"`, which never
  matches); a missing `JWT_SECRET` stops the server at startup; every response
  uses the JSON envelope (login returned `token` outside `data`, 404 was plain
  text).

### Week 8 – Layered architecture, RBAC, Material UI (`week-08/community-notice-board-*`)
- Same: users/admins, notifications, `withAuth`/`withAdmin`, admin seed script,
  MUI client.
- Structure: `routes → handlers → services → repositories → db`, with DTOs in
  `shared/` and entities in the API only, plus mapper functions between them.
- Added: `AppError` hierarchy (`BadRequest`, `Unauthorized`, `Forbidden`,
  `NotFound`, `Conflict`) mapped to responses by one `error()` hook.
- Fixed: no silent `"dev-secret"` JWT fallback; login no longer applies the
  registration password policy; malformed user ids return 400.

### Week 9 – Advanced React (`week-09/book-explorer`)
- Same: Open Library search, `useBookSearch` (fetch + abort),
  `useLocalStorage<T>`, `useMemo` for derived data, MUI layout.
- Added from the original plan: **pagination** (page reset in the event
  handlers, not an effect) with **server-side sorting** (sorting one page on
  the client would be wrong), a reusable `useDebouncedValue` hook, and
  `memo`/`useCallback` to show when referential equality matters.
- `useBookSearch` derives `loading` from a request key instead of calling
  `setLoading` inside the effect, which the current
  `eslint-plugin-react-hooks` (`set-state-in-effect`) rejects.

### Week 10 – OAuth 2.0 / OIDC / PKCE + i18n (`week-10/profile-viewer-*`)
- Same: Google sign-in via authorization code + PKCE, server-side sessions in an
  HttpOnly cookie, protected profile page, English/Finnish UI.
- Bun: `req.cookies.set/get/delete` replaces the hand-written cookie utility.
- Fixed: pending login requests and sessions now expire (upstream kept them
  forever); `/api/me` uses the envelope; the login page shows `?error=`
  feedback; cookies get `Secure` on HTTPS; the chosen language persists.
- Added: the mock OpenID provider and a 10-test end-to-end suite of the flow;
  type-checked translation keys; a layout route that fetches the session once.

### Week 11 – Building secure applications (`week-11/secure-application-*`)
- Same vulnerabilities and demos: A01 (3 cases), A02 (3), A04 (2), A05, A07 (4),
  using the OWASP Top 10:2025 numbering.
- Changed: `src/vulnerable/` and `src/secure/` side by side; one client can
  target either API.
- Added: working rate limiting on login (in the plan, never implemented
  upstream), which counts each attempt before the password check so parallel
  bursts cannot bypass it; secure mode seeds argon2id hashes so the seeded users can log in
  (upstream secure mode could not log them in); a Bun-served `CORS-test.html`
  on another origin; tests asserting each vulnerability and each fix.
- Replaces "Deno permission model" with **A03 Software Supply Chain Failures**:
  Bun blocks dependency lifecycle scripts by default (`trustedDependencies`),
  supports `bun audit`, `minimumReleaseAge` and frozen lockfiles. The docs also
  state plainly that Bun has no runtime permission sandbox, and what to use
  instead (containers, least-privilege users).

### Week 12 – Cloud deployment (`week-12/encrypted-file-vault-*`)
- Same: client-side AES-GCM encryption, key fingerprint onboarding, encrypted
  blobs in Azure Blob Storage, metadata in PostgreSQL, Container Apps + Static
  Web Apps + PostgreSQL Flexible Server.
- Bun: `oven/bun` Docker image, `bun build` with `--env=BUN_PUBLIC_*` for the
  API URL, `bunx @azure/static-web-apps-cli` for deployment.
- Fixed: `staticwebapp.config.json` added (upstream deep links returned 404 on
  Static Web Apps); malformed JSON returns 400; "fingerprint already set"
  returns 409 instead of 500; the dead `if (!SECRET)` check replaced by real
  validation; `ALLOWED_ORIGIN` must be set explicitly in production; the blob
  container is created once at startup; timestamps use `timestamptz`.
- Added: Azurite in `docker-compose.yml` so the whole app runs locally; TLS
  settings for Azure PostgreSQL documented (`?sslmode=require`, verified with
  Bun's SQL client); rate-limited login (from week 11); `/api/health` and
  graceful `SIGTERM` shutdown; the pasted key is checked against the account's
  fingerprint immediately.
- Changed: RESTful file URLs (`GET /api/files/:id/content`,
  `DELETE /api/files/:id`); `/api/auth/dashboard` became `/api/auth/me`; the
  fingerprint is required for uploads only (downloading ciphertext is harmless,
  deleting needs no key). The docs explain why this deployment uses a Bearer
  token rather than week 10's cookie (client and API are on different sites).

## 5. Upstream issues fixed (summary)

| Week | Issue | Effect upstream |
| ---- | ----- | --------------- |
| 4–6 | API sent `error: "text"`, clients read `error.message` | Error banners showed `undefined` |
| 4 | Client types used `id`/`fetchedAt`, API sent `externalId`/`savedAt` | Saved list showed "Invalid Date" |
| 6 | Malformed UUID passed to SQL | 400 with raw database error text |
| 7 | No body validation on register | 500 on missing fields |
| 7 | `error.message === "23505"` | Duplicate-email race never detected |
| 7, 12 | Missing `JWT_SECRET` not detected | Tokens signed with an empty or undefined key |
| 8 | `JWT_SECRET ?? "dev-secret"` | Production could silently use a public secret |
| 8 | Login validated password strength | Policy leaked; legacy passwords locked out |
| 10 | OIDC state and sessions never expired | Unbounded memory growth |
| 11 | Secure mode vs plaintext seeds | Seeded users could not log in after the fix |
| 11 | `Content-Type: application/json charset=utf-8` (missing `;`) | Invalid header |
| 12 | No SPA fallback on Static Web Apps | Refreshing `/login` returned 404 |
| 12 | "Fingerprint already set" mapped to 500 | Wrong status code |

## 6. Deno features with no direct Bun equivalent

- **Permission flags** (`--allow-net`, `--allow-read`, …). Bun runs with the
  user's full permissions. Week 1 mentions it; week 11 discusses what replaces
  it in practice (container isolation, non-root users, read-only filesystems,
  dependency hygiene). This is stated honestly rather than glossed over.
- **JSR.** Bun installs from npm. Every JSR package the course used has either a
  Bun built-in replacement (`@db/postgres`, `@felix/bcrypt`) or an npm original
  (`@panva/openid-client` → `openid-client`).
- **`deno fmt` / `deno lint`.** Replaced by the root ESLint config. Formatting is
  left to the editor.

`docs/deno-to-bun.md` has the full API mapping table for students who saw the
Deno version.

## 7. Repository layout

```
advanced-web-2026/
├── README.md                 course overview and week index
├── docs/
│   ├── PLAN.md               this document
│   ├── setup.md              installing Bun, Docker, editor setup, troubleshooting
│   ├── deno-to-bun.md        API mapping for readers of the Deno version
│   └── project-structure.md  how the back-end structure grows from week 1 to 12
├── package.json              workspaces + repo-wide scripts (setup:env, setup:db, typecheck, test, build, lint)
├── bunfig.toml               install policy (minimumReleaseAge)
├── eslint.config.js          one lint config for every project
├── docker-compose.yml        PostgreSQL 18 + Azurite
├── docker/postgres-init.sql  creates one database per week
├── scripts/setup-env.ts      creates .env files from .env.example with random secrets
├── week-XX/
│   ├── README.md             lecture notes and walkthrough
│   ├── shared/types.ts       API contract (full-stack weeks)
│   ├── <app>-api/            Bun back-end
│   └── <app>-client/         Bun-bundled React front-end
└── week-13/README.md         project starter checklist
```

## 8. Verification

Done for every project, and repeatable with the root scripts:

| Check | Command | Result |
| ----- | ------- | ------ |
| Type checking (strict) | `bun run typecheck` | 20/20 projects pass |
| API tests | `bun run test` | 132 tests pass (weeks 1, 2, 4–8, 10–12; database weeks against Docker PostgreSQL, week 12 also against Azurite) |
| Client builds | `bun run build` | all 10 clients build; the week 12 API bundles |
| Lint | `bun run lint` | clean, including the React hooks rules |
| Dependencies | `bun audit`, `bun pm untrusted` | no known vulnerabilities, no blocked install scripts |

Every application was also run and used in a browser: CRUD in week 2, hot
reload preserving state in week 3, error states with the API stopped in
week 4, real uploads in weeks 5–6, registration/login/expired-token handling
in week 7, admin and user roles (including a user deleted while logged in) in
week 8, search/paging/favourites persistence in week 9, the full OIDC login,
language switch and logout against the mock provider in week 10, both APIs and
the cross-origin CORS page in week 11, and register → onboarding → encrypted
upload → download/decrypt → reload → unlock in week 12. The week 12 Docker
image was built and run against local PostgreSQL and Azurite.

Not verified, because they need external accounts:

- the Google OIDC round trip (week 10). The same code path is verified against
  the mock provider; Google needs a GCP OAuth client (README, last section);
- the actual Azure deployment (week 12). The image, the TLS setting for Azure
  PostgreSQL, the bundling and the `bunx --bun @azure/static-web-apps-cli`
  command were checked locally; the Azure Portal steps follow last year's
  tested guide, adapted to Bun.

One environment note: on Apple Silicon the `linux/amd64` image crashes under
Docker's CPU emulation (Bun needs instructions QEMU does not provide). It runs
natively on arm64 and is expected to run on Azure's amd64 hosts; the week 12
README tells students to test locally without `--platform`.
