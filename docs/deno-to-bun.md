# From Deno to Bun: a mapping for this course

For students and teachers who know last year's Deno-based material. Both
runtimes run TypeScript directly and implement the Web standard APIs (`fetch`,
`Request`, `Response`, `URL`, `crypto`, `FormData`), so most code carries over
unchanged. The differences are in tooling, built-ins and permissions.

## Tooling

| Task | Deno | Bun |
| ---- | ---- | --- |
| New project | `deno init` | `bun init` |
| Config file | `deno.json` | `package.json` (+ `tsconfig.json`, optional `bunfig.toml`) |
| Run a script | `deno task dev` | `bun run dev` |
| Run a file | `deno run --allow-… main.ts` | `bun main.ts` |
| Restart on change | `deno run --watch` | `bun --watch` (or `bun --hot` to keep state) |
| Add a dependency | `deno add jsr:@db/postgres` / `deno add npm:jose` | `bun add jose` |
| Lockfile | `deno.lock` | `bun.lock` |
| Type check | `deno check` | `tsc --noEmit` (Bun never type-checks) |
| Test | `deno test` | `bun test` (Jest-compatible API from `bun:test`) |
| Lint / format | `deno lint`, `deno fmt` | ESLint (repository root), editor formatting |
| React dev server | Vite (`deno run -A npm:vite`) | `bun ./index.html` |
| Production front-end build | `vite build` | `bun build ./index.html --outdir=dist --production` |
| Front-end env variables | `VITE_*` via `import.meta.env` | `BUN_PUBLIC_*` via `process.env`, with `--env='BUN_PUBLIC_*'` |
| Single executable | `deno compile` | `bun build --compile` |
| Docker base image | `denoland/deno` | `oven/bun` |

## Runtime APIs used in the course

| Task | Deno | Bun |
| ---- | ---- | --- |
| HTTP server | `Deno.serve({ port }, handler)` | `Bun.serve({ port, fetch: handler })`, or `routes: { "/api/x/:id": { GET, PUT } }` |
| Route parameters | parse `url.pathname` by hand | `req.params.id` (typed from the route path) |
| Read a file | `Deno.readFile` / `Deno.readTextFile` | `Bun.file(path).bytes()` / `.text()` / `.json()` |
| Write a file | `Deno.writeFile` | `Bun.write(path, data)` (creates folders) |
| Serve a file | read it, set `Content-Type` yourself | `new Response(Bun.file(path))` (type detected) |
| Create a folder | `Deno.mkdir(dir, { recursive: true })` | `mkdir` from `node:fs/promises` |
| Environment variable | `Deno.env.get("X")` (+ `--allow-env`) | `Bun.env.X` or `process.env.X` |
| `.env` files | `--env-file=.env` | loaded automatically |
| PostgreSQL | `jsr:@db/postgres` (`pool.connect()`, `queryObject`) | built-in: `import { SQL } from "bun"`, ``sql`select … ${x}` `` |
| Password hashing | `jsr:@felix/bcrypt` | built-in: `Bun.password.hash()` / `.verify()` (Argon2id or bcrypt) |
| Cookies | parse the `Cookie` header by hand | `req.cookies.get()` / `.set()` / `.delete()` |
| JWT | `npm:jose` | `jose` (same library) |
| OpenID Connect | `jsr:@panva/openid-client` | `openid-client` (same library, from npm) |
| Azure Blob Storage | `npm:@azure/storage-blob` | `@azure/storage-blob` (same library) |
| Is this file the entry point? | `import.meta.main` | `import.meta.main` |
| Directory of this file | `import.meta.dirname` | `import.meta.dir` (or `import.meta.dirname`) |

## Imports

Deno required file extensions (`./router.ts`). Bun accepts both `./router` and
`./router.ts`; this course leaves them out, as most TypeScript projects do.
Packages are imported by name (`import { SignJWT } from "jose"`), resolved from
`node_modules`.

## Permissions

The biggest conceptual difference. Deno denies network, file, environment and
subprocess access unless granted with `--allow-*` flags. **Bun, like Node.js,
has no permission system**: a program and all its dependencies run with the
full rights of the user who started it.

Consequences, discussed in week 11:

- Dependencies are the main risk. Bun does not run dependencies' install
  scripts unless they are listed in `trustedDependencies`; `bunfig.toml` can
  require a minimum release age (`minimumReleaseAge`); `bun audit` checks for
  known vulnerabilities; the lockfile pins exact versions.
- Isolation comes from the environment: containers, non-root users, read-only
  filesystems, minimal secrets (week 12's Dockerfile runs as the unprivileged
  `bun` user).

## Things that did not need to change

Request handlers (`(req: Request) => Response`), `fetch`, `URL`,
`URLSearchParams`, `FormData`, `crypto.randomUUID()`, Web Crypto, `jose`,
React components, MUI, i18next and the SQL itself.
