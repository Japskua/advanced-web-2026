# Setup and troubleshooting

Everything you need to run any week of the course on your own machine.

## 1. Install the tools

| Tool | Needed for | Install |
| ---- | ---------- | ------- |
| **Bun** 1.3+ | every week | macOS/Linux/WSL: `curl -fsSL https://bun.sh/install \| bash`<br>Windows: `powershell -c "irm bun.sh/install.ps1 \| iex"`<br>Homebrew: `brew install oven-sh/bun/bun` |
| **Docker Desktop** | weeks 6–12 (PostgreSQL, Azurite) | <https://www.docker.com/products/docker-desktop/> |
| **Git** | cloning, submitting | <https://git-scm.com/downloads> |
| **Azure CLI** | week 12 deployment only | <https://learn.microsoft.com/cli/azure/install-azure-cli> |

Check:

```bash
bun --version        # 1.3.0 or newer
docker --version
```

Keep Bun up to date with `bun upgrade`.

**Editor.** VS Code with the recommended extensions (the repository's
`.vscode/extensions.json` suggests them when you open the folder): the
official *Bun* extension and *ESLint*. TypeScript support is built into VS Code.

**Browser.** Any current Chrome, Edge, Firefox or Safari. Install the *React
Developer Tools* extension for weeks 3–12. Week 12 uses
`Uint8Array.prototype.toBase64()`, available in browsers released since 2025.

## 2. Clone and install

```bash
git clone <repository-url> advanced-web-2026
cd advanced-web-2026
bun install
```

One `bun install` at the root installs the dependencies of all twenty projects
(they are Bun workspaces sharing one `bun.lock`). Running `bun install` inside
a single project folder does the same.

## 3. Environment files

APIs from week 6 on read their configuration from a `.env` file, which is
never committed. Each project has a committed `.env.example` describing the
variables. Create all `.env` files at once:

```bash
bun run setup:env
```

This copies every missing `.env.example` to `.env` and puts a fresh random
value into each `JWT_SECRET`. Existing `.env` files are left alone. Bun loads
`.env` automatically whenever a program, script or test starts: no package,
no flag.

Week 10 additionally needs Google credentials (or the mock provider); see its
README.

## 4. Databases and storage (weeks 6–12)

```bash
bun run services:up      # docker compose up -d --wait
bun run setup:db         # every project's `bun run db:setup`
```

`docker-compose.yml` starts:

- **PostgreSQL 18** on `localhost:5432` (user `postgres`, password `postgres`).
  On first start it creates one database per week: `image_gallery`,
  `secret_notes`, `notice_board`, `secure_app_vulnerable`, `secure_app_secure`,
  `file_vault`.
- **Azurite**, the Azure Storage emulator, on `localhost:10000` (week 12).

Other useful commands:

| Command | Effect |
| ------- | ------ |
| `docker compose ps` | status |
| `bun run services:down` | stop (data is kept in Docker volumes) |
| `docker compose down -v` | stop **and delete all data** |
| `docker exec -it awa-postgres psql -U postgres -d <database>` | an SQL prompt |

Week 8's first administrator is created separately:
`cd week-08/community-notice-board-api && bun run seed:admin`.
Week 11's `bun run db:setup` *resets* its databases to the demo data; run it
again after a demonstration.

## 5. Running a week

Each week's README has the exact commands. The pattern:

```bash
cd week-XX/<something>-api
bun run dev              # API with restart-on-save, http://localhost:8000
bun test                 # the API's tests

cd week-XX/<something>-client
bun run dev              # client with hot reload, http://localhost:5173
bun run build            # production build into dist/
```

`bun run typecheck` works in every project. Bun itself never checks types, so
run it (or watch your editor) before committing.

## 6. Checking the whole repository

```bash
bun run typecheck && bun run lint && bun run test && bun run build
```

`bun run test` needs steps 3 and 4. It runs every API's tests in parallel
(132 tests). The database tests use their week's database and remove the rows
they create.

## Troubleshooting

**`bun: command not found` after installing.** Open a new terminal; the
installer changes your `PATH`. On Windows, sign out and in again if needed.

**`Missing environment variable DATABASE_URL` (or `JWT_SECRET`, …).** The
project has no `.env`. Run `bun run setup:env` at the root, or
`cp .env.example .env` in the project folder.

**`ECONNREFUSED 127.0.0.1:5432` / connection refused.** PostgreSQL is not
running: `bun run services:up`, and check `docker compose ps`.

**`relation "…" does not exist`.** The tables were not created:
`bun run db:setup` in that API's folder (or `bun run setup:db` at the root).

**Port already in use (`EADDRINUSE`).** Another program uses port 8000 or
5173: often a dev server from another week that is still running. Stop it, or
start on another port: the APIs of weeks 6–8, 10 and 12 read `PORT`
(`PORT=8010 bun run dev`); in weeks 1–5 change the `PORT` constant (week 11
uses fixed ports 8000/8001); for a client, edit the port in
its `dev` script and the API's allowed origin.

**`localhost:5173` shows a different app.** Another dev server (for example a
Vite project) may listen on `localhost:5173` over IPv6 while Bun listens on
IPv4; the browser then reaches the other one. Stop the other server, or open
`http://127.0.0.1:5173`. For weeks that use cookies or a fixed CORS origin
(10–12), use the same host name everywhere, or change the port.

**A CORS error in the browser console.** The API must allow the exact origin
of the page: scheme, host and port. For weeks 10–12 check `FRONTEND_URL` /
`ALLOWED_ORIGIN` in the API's `.env`. `localhost` and `127.0.0.1` are different
origins.

**`@types/bun@^x.y.z failed to resolve` during `bun add`/`bun install`.** The
repository's `bunfig.toml` only accepts package versions published at least
three days ago (see week 11, supply-chain security). Use a slightly older
version range, or wait.

**Type errors appear in the editor but `bun run dev` works.** That is expected:
Bun strips types without checking them. The errors are real; fix them.

**Docker on Apple Silicon: a `linux/amd64` image crashes.** Bun cannot run
under Docker's x86 emulation. Build without `--platform` to test locally; build
with `--platform linux/amd64` only for pushing to Azure (week 12).
