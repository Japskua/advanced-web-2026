# Advanced Web Applications 2026 – with Bun

Lecture material for the *Advanced Web Applications* course: twelve weeks of
full-stack TypeScript, from a single JSON endpoint to an end-to-end encrypted
file vault deployed on a plain cloud server (Hetzner or DigitalOcean). Every project runs on **[Bun](https://bun.sh)**:
the runtime, the package manager, the bundler for the React front-ends and the
test runner. There is no Node.js, Deno or Vite in the toolchain.

This is a port of the 2026 Deno-based material
([eclap5/Advanced-Web-Applications-2026](https://github.com/eclap5/Advanced-Web-Applications-2026)).
The weekly topics and applications are the same; [docs/PLAN.md](docs/PLAN.md)
explains what changed and why.

## Weeks

| Week | Topic | Application | Highlights |
| ---- | ----- | ----------- | ---------- |
| [1](week-01/README.md) | TypeScript & Bun | Todo API (one endpoint) | `bun init`, `Bun.serve`, types/interfaces/generics, `tsc`, first `bun test` |
| [2](week-02/README.md) | REST API | Todo API + plain HTML/JS front-end | Route table with `:params`, CRUD, status codes, validation, discriminated unions, static files |
| [3](week-03/README.md) | React | Habit Tracker | Components, props, state, immutable updates, `useMemo`; Bun's dev server and bundler |
| [4](week-04/README.md) | Full-stack data flow | Joke Dashboard | `useEffect` + cleanup, loading/error states, service layer, CORS, shared types, `502`/`504` |
| [5](week-05/README.md) | File system & uploads | Image Gallery | `multipart/form-data`, `Bun.file`/`Bun.write`, magic-byte checks, middleware |
| [6](week-06/README.md) | SQL database | Image Gallery v2 | Bun's built-in PostgreSQL client, parameterised queries, repositories, `.env` |
| [7](week-07/README.md) | Authentication | Secret Notes | `Bun.password` (Argon2id), JWT, React Router, protected routes |
| [8](week-08/README.md) | Elysia & layered architecture | Community Notice Board | Elysia (plugins, schema validation), routes → services → repositories, DTO vs entity, RBAC with a macro, `AppError` + `onError`, shadcn/ui + Tailwind CSS |
| [9](week-09/README.md) | Advanced React | Book Explorer | Custom hooks, debouncing, race conditions, pagination, `memo`/`useCallback` |
| [10](week-10/README.md) | OAuth 2.0 / OIDC | Profile Viewer | Google sign-in with PKCE, `HttpOnly` sessions, i18n (en/fi), a mock identity provider |
| [11](week-11/README.md) | Secure applications | Security demo | OWASP Top 10:2025, vulnerable vs. secure side by side, rate limiting, supply-chain security |
| [12](week-12/README.md) | Cloud deployment | Encrypted File Vault | Web Crypto (AES-GCM), S3-compatible object storage, Docker Compose, Caddy (HTTPS), a Hetzner / DigitalOcean server |
| [13](week-13/README.md) | Project | your own | A starter checklist built from weeks 1–12 |

Each week's README is the lecture material: learning objectives, the concepts
with code from the project, a step-by-step lecture walkthrough, `curl`
examples, a comparison with last year's Deno version, exercises and further
reading. Every project folder also has a short README of its own: how to run
it, its scripts and its configuration.

## Exercises and grading

The weekly graded exercises are published on Moodle and submitted to
CodeGrade. This repository contains the lecture code only: no exercise
solutions and no grading tests. The "Exercises" section at the end of each
week's README is ungraded practice.

## Quick start

You need [Bun](https://bun.sh) 1.4.4 or newer and, from week 6 on,
[Docker](https://www.docker.com/products/docker-desktop/). Details and
troubleshooting: [docs/setup.md](docs/setup.md).

```bash
git clone <this repository> && cd advanced-web-2026
bun install              # installs every week's dependencies
bun run setup:env        # creates each project's .env from .env.example (with random secrets)
bun run services:up      # PostgreSQL + SeaweedFS object storage in Docker (weeks 6–12)
bun run setup:db         # creates the tables of every database week

cd week-04/joke-dashboard-api && bun run dev          # then, in another terminal:
cd week-04/joke-dashboard-client && bun run dev       # http://localhost:5173
```

APIs listen on `http://localhost:8000` (week 11's secure API also on `8001`),
clients on `http://localhost:5173`.

## Checking everything

From the repository root:

| Command | What it does |
| ------- | ------------ |
| `bun run typecheck` | `tsc --noEmit` in all 20 projects |
| `bun run test` | `bun test` in every API: 132 tests (needs `services:up`, `setup:env`, `setup:db`) |
| `bun run build` | production builds of all clients (and the week 12 API bundle) |
| `bun run lint` | ESLint over everything, including the React hooks rules |
| `bun audit` | known vulnerabilities in dependencies |

## Repository layout

```
advanced-web-2026/
├── README.md                this file
├── docs/
│   ├── PLAN.md              how the Deno material was ported, decisions, fixed bugs
│   ├── setup.md             installing Bun and Docker, running weeks, troubleshooting
│   ├── deno-to-bun.md       API mapping for readers of the Deno version
│   └── project-structure.md how the back-end structure grows from week 1 to 12
├── package.json             Bun workspaces + the commands above
├── bunfig.toml              install policy (minimum release age, see week 11)
├── eslint.config.js         one lint config for every project
├── docker-compose.yml       PostgreSQL 18 + SeaweedFS (S3-compatible object storage)
├── docker/postgres-init.sql one database per week
├── scripts/setup-env.ts     bun run setup:env
└── week-01 … week-13/       one folder per week: README.md, the projects, shared/ types
```

Every project folder (`week-XX/<name>`) has its own `package.json` and
`tsconfig.json`, so it can be copied out of the repository and used on its own
(`bun install` inside it). Inside the repository they are
[Bun workspaces](https://bun.sh/docs/pm/workspaces): one `bun install`
and one lockfile for everything.

## Conventions used throughout

- APIs answer `{ "ok": true, "data": … }` or `{ "ok": false, "error": { "message": … } }` (from week 2). The exception is week 11's demo API, which shows raw answers on purpose.
- Full-stack weeks put the API contract in `week-XX/shared/types.ts`, imported as `@shared/types` by both sides.
- Configuration comes from `.env` (copied from `.env.example`, never committed); each API validates it in `config.ts` and refuses to start without required values.
- Tests live in each API's `tests/` folder; database tests clean up after themselves.
- Code comments explain *why*, because the code is read by students.

## Versions

Written and tested with Bun 1.4.4, Elysia 1.4, TypeScript 6.0, React 19.3,
React Router 8, shadcn/ui with Tailwind CSS 4, PostgreSQL 18. TypeScript stays
on 6.0 because `typescript-eslint` does not support TypeScript 7 yet.
