# Week 13 – Project work

There is no new lecture code this week: you build your own full-stack
application. The requirements, the schedule and the grading criteria are on
the course page. This document is a practical starting point that collects the
patterns from weeks 1–12.

## Starting a project

The quickest start is to copy the week whose structure is closest to what you
need, then rename things:

| You need… | Start from |
| --------- | ---------- |
| A REST API with a database, auth and roles, plus a React client (shadcn/ui + Tailwind CSS) | `week-08` |
| Sign-in with Google instead of passwords | `week-10` |
| File uploads to object storage, deployment to a cloud server (Hetzner, DigitalOcean) | `week-12` |
| A front-end only, against a public API | `week-09` |

```bash
cp -r week-08 ~/my-project && cd ~/my-project
# in each project folder: rename "name" in package.json, then
bun install
```

A copied project works outside this repository: each folder has its own
`package.json` and `tsconfig.json`. Bring along what lives at the repository
root if you want it: `docker-compose.yml` (databases), `eslint.config.js`
(lint) and `bunfig.toml` (install safety).

Or start from scratch: `bun init` for the API (week 1), and `bun init` plus
`bun add react react-dom` for the client (week 3).

## A checklist from the course

**Structure (weeks 4–8)**

- [ ] API in layers: routes → handlers → services → repositories → database.
- [ ] DTOs in a `shared/` folder used by both sides; entities stay in the API; mappers in between.
- [ ] One response envelope (`{ ok, data }` / `{ ok, error }`) and `AppError` classes with a central `error` handler.

**Data (weeks 5–6, 12)**

- [ ] Schema in `sql/schema.sql`, applied by a script; constraints (`not null`, `unique`, `check`, foreign keys).
- [ ] Only parameterised queries (tagged templates). Never `sql.unsafe()` with user input.
- [ ] Files in object storage (or at least outside the database), metadata in the database.

**Security (weeks 7, 8, 10, 11)**

- [ ] Every input validated on the server; ids checked before they reach the database.
- [ ] Passwords hashed with `Bun.password`; same error for unknown user and wrong password; login rate-limited.
- [ ] Every protected route wrapped (`withAuth`, `withRole`); ownership checked on every object access.
- [ ] Secrets only in `.env` (git-ignored) and in the cloud's secret settings; `config.ts` refuses to start without them.
- [ ] CORS limited to your client's origin; no debug endpoints; errors without internals.
- [ ] `bun audit` clean; `bunfig.toml` with `minimumReleaseAge`.

**Front-end (weeks 3, 4, 9)**

- [ ] All server calls in an `api.ts` with one `request<T>()` helper.
- [ ] Loading, error and empty states for everything that loads.
- [ ] Effects clean up (AbortController, timers); state is derived where possible.
- [ ] `bun run lint` passes, including the React hooks rules.

**Quality**

- [ ] `bun run typecheck` passes.
- [ ] `bun test` covers the important API behaviour: happy paths *and* the 4xx cases.
- [ ] A README that explains how to run the project from a fresh clone.

**Deployment (week 12)**

- [ ] API as a container (bundle + `oven/bun`, non-root), client as static files with an SPA fallback.
- [ ] `BUN_PUBLIC_*` variables only for public values.

## Useful commands

```bash
bun init                     # new project
bun add <pkg> / bun add -d <pkg>
bun run dev                  # your scripts
bun test --watch             # re-run tests on save
bun run typecheck            # tsc --noEmit
bun audit                    # known vulnerabilities in dependencies
bun build ./index.html --outdir=dist --production   # client production build
```

## Where to look things up

- This repository: each week's README explains its concepts in depth.
- [docs/project-structure.md](../docs/project-structure.md) shows how the API structure grew from week 1 to 12.
- [Bun documentation](https://bun.sh/docs), [react.dev](https://react.dev),
  [MUI](https://mui.com/material-ui/), [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/).
