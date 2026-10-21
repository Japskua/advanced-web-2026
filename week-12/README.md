# Week 12 – Deploying to a cloud server: the Encrypted File Vault

The last application brings the course together and puts it **on the
internet**. The **Encrypted File Vault** lets users store files that nobody
else can read: files are encrypted **in the browser** with a key that never
leaves the user's hands, and only ciphertext is uploaded. The API keeps
metadata in **PostgreSQL** and the encrypted bytes in **S3-compatible object
storage**.

Everything runs locally first (PostgreSQL and SeaweedFS object storage in
Docker). Then the whole application goes to **one rented Linux server** at
[Hetzner](https://www.hetzner.com/cloud) or
[DigitalOcean](https://www.digitalocean.com/products/droplets), run by
**Docker Compose**: **Caddy** in front (HTTPS certificates, the React app, a
reverse proxy to the API), the API container, PostgreSQL, and the object
storage. It costs a few euros a month, involves no proprietary platform, and
every step works the same at any other provider, or on your own hardware.

## Learning objectives

After this week you can:

- encrypt and decrypt files in the browser with the Web Crypto API (AES-GCM), and explain the role of the key, the IV and the authentication tag
- design a system in which the server never sees plaintext, and state its trade-offs (lost key = lost files)
- store files in S3-compatible object storage instead of the server's disk, with Bun's built-in `S3Client`, and develop against a local S3 server
- configure an application per environment: runtime variables for the API, build-time variables for the client
- package a Bun API as a small container image, run as non-root, with a health check and graceful shutdown
- run a full-stack application on a cloud server with Docker Compose, behind a reverse proxy with automatic HTTPS
- operate it: deploy updates, read logs, back up the database, and debug the usual problems (DNS, certificates, environment variables)
- manage authentication state with React context

## How the application works

**Registration and onboarding**

1. A user registers with an **invitation code** (so strangers cannot use your deployment) and logs in.
2. On first login the browser generates a random **256-bit AES-GCM key** and shows it as Base64. The user must save it.
3. The browser sends only the key's **SHA-256 fingerprint** to the API, which stores it.

**Uploading**

4. In each session the user pastes the key; the browser checks its fingerprint against the account's.
5. A selected file is encrypted in the browser with AES-GCM and a fresh random 12-byte IV.
6. The browser uploads the ciphertext with metadata: original name, type, size, the IV, the key fingerprint.
7. The API checks that the fingerprint matches the account, stores the ciphertext in object storage under
   the key `<user id>/<file id>`, and the metadata in PostgreSQL.

**Downloading and deleting**

8. The browser downloads the ciphertext of one of *its own* files and decrypts it locally with the key and the stored IV.
9. Deleting removes the metadata row, then the object.

**What the server knows.** Email, password hash, key fingerprint, file names,
sizes and types, and ciphertext. Not the key, and not the contents of any file.
Someone with full access to the server, or to the storage provider, cannot read
the files. The flip side: if a user loses their key, their files are gone for
good.

## API

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/api/health` | – | health check for Docker (and load balancers) |
| `POST` | `/api/auth/register` | – | `{ email, password, inviteCode }` → `201` |
| `POST` | `/api/auth/login` | – | → `{ token, user }`; `429` after 5 attempts in 15 minutes |
| `GET` | `/api/auth/me` | token | the current user, incl. `keyFingerprint` |
| `POST` | `/api/auth/onboarding` | token | `{ keyFingerprint }`, once (`409` the second time) |
| `GET` | `/api/files` | token | the caller's files |
| `POST` | `/api/files` | token | multipart: encrypted `file` + metadata |
| `GET` | `/api/files/:id/content` | token | the ciphertext |
| `DELETE` | `/api/files/:id` | token | `204` |

## Running it locally

```bash
# repository root, once: PostgreSQL (database file_vault) and SeaweedFS
# (S3 on localhost:8333, with the bucket encrypted-files)
docker compose up -d

# terminal 1
cd week-12/encrypted-file-vault-api
cp .env.example .env              # set JWT_SECRET; the rest works with docker compose as it is
bun run db:setup
bun run dev                       # http://localhost:8000 (checks the bucket on startup)
bun test                          # 13 integration tests: real AES-GCM, PostgreSQL, SeaweedFS

# terminal 2
cd week-12/encrypted-file-vault-client
cp .env.example .env              # BUN_PUBLIC_API_URL=http://localhost:8000
bun run dev                       # http://localhost:5173 — register with the invite code AWA2026
```

## Project structure

```
week-12/
├── shared/
│   ├── types.ts                      UserDto, FileDto, request bodies, ApiResult<T>
│   └── limits.ts                     MAX_FILE_BYTES, AES-GCM IV and tag sizes
├── encrypted-file-vault-api/
│   ├── Dockerfile, .dockerignore     the API image (bundle + Bun, non-root, HEALTHCHECK)
│   ├── sql/schema.sql                users (key_fingerprint), files (object_key, encryption_iv)
│   └── src/
│       ├── main.ts                   checkStorage(), Bun.serve, SIGTERM handling
│       ├── config.ts                 every setting from the environment
│       ├── routes.ts                 the route table (+ /api/health)
│       ├── handlers/                 auth-handlers (rate-limited login), file-handlers
│       ├── services/
│       │   ├── auth-service.ts       invite code, hashing, onboarding
│       │   ├── file-service.ts       fingerprint check, upload/download/delete
│       │   └── object-storage.ts     S3 through Bun's built-in S3Client
│       ├── repositories/             users, files (every file query includes the owner)
│       ├── middleware/               auth (withAuth), logger, middleware
│       ├── errors.ts, mappers.ts, types.ts
│       └── util/                     jwt, rate-limiter (from week 11), client-ip, response, validation
├── encrypted-file-vault-client/
│   ├── bunfig.toml                   dev server: inline BUN_PUBLIC_* variables, Tailwind CSS plugin
│   ├── build.ts                      `bun run build`: Bun.build() into dist/, same env rule + Tailwind
│   ├── .env.example                  BUN_PUBLIC_API_URL
│   └── src/
│       ├── config.ts                 API_URL from the build
│       ├── index.css                 Tailwind CSS + the shadcn/ui theme (set up as in week 8)
│       ├── crypto.ts                 generateKey, importKey, fingerprintOf, encryptFile, decryptBytes
│       ├── api.ts                    requests + the token store
│       ├── auth/                     AuthContext, AuthProvider, useAuth
│       ├── encryption/               EncryptionKeyContext, EncryptionKeyProvider, useEncryptionKey
│       ├── components/               RouteGuards, KeyManager, FileUploadForm, FileList, AuthPageLayout
│       ├── components/ui/            shadcn/ui components (copied in by `shadcn add`, yours to edit)
│       └── pages/                    Login, Register, Onboarding, Dashboard
└── deploy/                           the production setup
    ├── compose.yml                   Caddy + API + PostgreSQL + SeaweedFS on one server
    ├── web/Dockerfile, web/Caddyfile the web server image: Caddy + the built client
    ├── prepare.ts                    builds everything into deploy/out/, generates the secrets
    └── out/                          (generated, git-ignored) what you copy to the server
```

---

## Concepts

### Encryption in the browser: Web Crypto and AES-GCM

```ts
const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);

const iv = crypto.getRandomValues(new Uint8Array(12));                 // fresh for EVERY file
const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, await file.arrayBuffer());

const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
```

- **AES** is the standard symmetric cipher (the same key encrypts and decrypts);
  256-bit keys are effectively impossible to brute-force.
- **GCM** mode also *authenticates*: it appends a 16-byte tag, and decryption
  fails if anything was changed. Tampering is detected, not just hidden. (The
  API uses this: ciphertext must be exactly plaintext size + 16 bytes.)
- The **IV** (nonce) must never repeat for the same key, so every file gets a
  new random one. It is not secret and is stored with the metadata.
- The **fingerprint** (`SHA-256(key)`, hex) identifies a key without revealing
  it. It lets the client say "this is not your key" before anything goes wrong,
  and lets the API refuse uploads encrypted with another key. It is a safety
  net, not a credential.
- `Uint8Array.prototype.toBase64()`, `Uint8Array.fromBase64()` and `toHex()`
  are recent JavaScript additions, available in current browsers and Bun.

The key lives only in React state (`EncryptionKeyProvider`). A reload forgets
it, and the user pastes it again. Storing it in `localStorage` would be more
convenient and would expose it to any XSS bug; that trade-off is deliberate.

The same Web Crypto API exists in Bun, which is why the API's tests can
encrypt exactly like the browser.

**Web Crypto needs a secure context.** Browsers only provide `crypto.subtle`
on pages served over **HTTPS**, or from `localhost` during development. Opened
over plain `http://` at a public IP address, this app cannot generate a key at
all. HTTPS is not an optional extra for the deployment; the app depends on it.

### Object storage instead of the server's disk

Week 5 wrote uploads into a folder. That does not survive contact with
production: a container's filesystem disappears when the container is replaced
(every deployment), and two copies of the API would each have their own files.
**Object storage** is a separate service for files: *objects* in a *bucket*,
each addressed by a *key* (a name like `3f2a…/9c1d…`), reachable over HTTP from
anywhere that has the credentials.

**S3** is Amazon's object storage API, and it has become the standard that
almost everyone speaks. The same code works with all of these; only the
endpoint and the credentials change:

| Where | Endpoint (`S3_ENDPOINT`) | Notes |
| ----- | ------------------------ | ----- |
| SeaweedFS in Docker (local, or on your server) | `http://localhost:8333` / `http://object-storage:8333` | open source, one container |
| Hetzner Object Storage | `https://fsn1.your-objectstorage.com` (also `nbg1`, `hel1`) | region = the location, e.g. `fsn1` |
| DigitalOcean Spaces | `https://fra1.digitaloceanspaces.com` (or `ams3`, `nyc3`, …) | region = `us-east-1` (the endpoint decides the location) |
| Others | Cloudflare R2, Backblaze B2, Scaleway, OVHcloud, AWS S3 | same idea |

Bun has an S3 client **built in**, so no SDK is needed:

```ts
import { S3Client } from "bun";

const storage = new S3Client({ endpoint, bucket, region, accessKeyId, secretAccessKey });

await storage.write(`${userId}/${fileId}`, bytes);            // upload
const bytes = await storage.file(objectKey).bytes();          // download
await storage.delete(objectKey);                              // delete
await storage.list({ maxKeys: 1 });                           // used at startup to check the bucket
```

`services/object-storage.ts` wraps exactly these calls. At startup,
`checkStorage()` lists one object: wrong credentials, a missing bucket or an
unreachable endpoint stop the API immediately with a clear message, instead of
failing on the first upload.

Two details differ between providers:

- **Addressing style.** *Path style* puts the bucket in the path
  (`https://host/bucket/key`); *virtual-hosted style* puts it in the host name
  (`https://bucket.host/key`). SeaweedFS uses path style (the default here);
  Hetzner and DigitalOcean document virtual-hosted style, so set
  `S3_VIRTUAL_HOSTED_STYLE=true` for them.
- **Region.** Requests are signed with a region name. SeaweedFS accepts any;
  Hetzner uses the location (`fsn1`); DigitalOcean uses `us-east-1`.

Locally, **SeaweedFS** runs in `docker-compose.yml` (`weed mini`, one process
with everything an S3 server needs), creates the bucket `encrypted-files` on
startup and checks the development keys from that file.

The upload writes the object first and the row second, deleting the object if
the row fails; delete removes the row first (week 6's reasoning: a leftover
object is invisible garbage, a row without its object is a broken file).

### Configuration per environment

The same code runs on a laptop and on the server; only configuration changes.

| | API (server) | Client (static files) |
| - | ------------ | --------------------- |
| When is config read? | at **runtime**, on every start | at **build time**, baked into the JS |
| Local | `.env` (loaded by Bun) | `.env` + `bunfig.toml` |
| Server | `deploy/out/.env` → `compose.yml` → the container's environment | `prepare.ts` runs `BUN_PUBLIC_API_URL=<site> bun run build` |
| Can hold secrets? | yes | **never**: anyone can read the bundle |

The client has no server to read variables at runtime, so Bun's bundler
replaces `process.env.BUN_PUBLIC_API_URL` with its value while building. Only
variables with the `BUN_PUBLIC_` prefix are inlined (`env: "BUN_PUBLIC_*"`), so
a secret in the environment cannot leak into the bundle by accident.
`config.ts` falls back to `localhost:8000` if the variable was not set.

The setting is in two places. `bunfig.toml` has it for the dev server
(`[serve.static] env = "BUN_PUBLIC_*"`), and `build.ts` for the production
build: `bun run build` runs `build.ts`, which calls `Bun.build()` with the same
`env` rule and the Tailwind CSS plugin (the UI is shadcn/ui and Tailwind CSS,
set up as in week 8). The result in `dist/` is an `index.html`, one JavaScript
file and one CSS file: plain static files that Caddy serves.

The API reads every variable in `config.ts` and refuses to start if one is
missing. In particular, `ALLOWED_ORIGIN` has no `*` default, and `JWT_SECRET`
must be at least 32 characters and not the placeholder from `.env.example`.

### The production architecture: one server

```
                         your server (Hetzner / DigitalOcean)
                ┌─────────────────────────────────────────────────────┐
  browser ──443─┼─▶ caddy ──/api/*──▶ api ──▶ postgres                  │
   (HTTPS)      │     │                 └───▶ object-storage (SeaweedFS) │
                │     └─ everything else: the React app (static files)   │
                └─────────────────────────────────────────────────────┘
                     only ports 80 and 443 are open to the internet
```

One server with Docker Compose is how a large share of real web applications
run, and it is the right starting point: cheap, easy to understand, easy to
debug with `ssh`. When one server is not enough, the pieces move out one at a
time (a managed database, the provider's object storage, more API containers
behind a load balancer), and nothing in the code has to change, because every
connection is already configured through environment variables.

What a managed platform would do for you, you now do yourself: install updates,
take backups, watch the logs. The deployment steps below cover each of those.

`deploy/compose.yml` in detail:

- **`restart: unless-stopped`**: containers come back after a crash or a reboot.
- **Health checks and `depends_on: condition: service_healthy`**: the API starts
  only when PostgreSQL accepts connections; Caddy starts only when the API's
  `/api/health` answers. `docker compose ps` shows the health of each.
- **Volumes** (`postgres-data`, `object-storage-data`, `caddy-data`) keep the
  data when containers are replaced. Deleting a volume deletes the data.
- **Only Caddy publishes ports.** The API, PostgreSQL and SeaweedFS are reachable
  only inside the Compose network, by service name (`postgres:5432`), and never
  from the internet.
- **Log rotation** (`x-logging`): at most 30 MB of logs per container, so logs
  cannot fill the disk.
- **A profile** for the object storage: `COMPOSE_PROFILES=self-hosted-storage`
  in `.env` starts SeaweedFS on the server; remove that line to use Hetzner's or
  DigitalOcean's object storage instead.
- **`schema.sql`** is mounted into `/docker-entrypoint-initdb.d/`: PostgreSQL's
  image runs it once, when the database volume is created.

### Caddy: HTTPS, the reverse proxy and client-side routing

[Caddy](https://caddyserver.com) is a web server whose defining feature is
**automatic HTTPS**: give it a public host name, and it obtains a certificate
from Let's Encrypt, renews it before it expires, and redirects HTTP to HTTPS.
The configuration (`deploy/web/Caddyfile`, without its comments):

```caddyfile
{$PUBLIC_URL} {
	encode zstd gzip

	handle /api/* {
		reverse_proxy api:8000            # the API container
	}

	handle {
		root * /srv/client                # the built React app
		try_files {path} /index.html      # the SPA fallback
		file_server
	}

	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}
}
```

- **Reverse proxy.** The browser talks only to Caddy; Caddy forwards `/api/*`
  to the API container. Client and API share one **origin**
  (`https://vault.…`), so in production the browser makes no cross-origin
  requests at all. (CORS is still configured, for development, where the client
  runs on port 5173 and the API on 8000.)
- **The SPA fallback.** Refreshing `https://…/login` asks the server for a file
  called `login`, which does not exist. React Router needs every unknown path to
  return `index.html`, and `try_files` does exactly that. Without it (last
  year's deployment), deep links return 404.
- **The client's real IP.** Every request now arrives at the API *from Caddy*.
  The login rate limit (week 11) must not treat all users as one IP address, so
  the API trusts the `X-Forwarded-For` header that Caddy adds, and only because
  `TRUST_PROXY=true` says it runs behind a proxy (`util/client-ip.ts`).
- **Security headers.** HSTS tells browsers to use HTTPS for this site from now
  on; the others are week 11's defaults.

`deploy/web/Dockerfile` bakes the Caddyfile and the built client into an image
(`FROM caddy:2-alpine`), just like the API's image contains its bundle. A
deployment replaces both images as a whole; no stale files are left behind.

### Why a token and not a session cookie

Week 10 argued for `HttpOnly` cookies, and this app still uses a Bearer token
in `localStorage` (weeks 7–8). The token works wherever the client runs: on
another port in development, on another domain, in a mobile app. In the
production setup above, client and API share one origin, so a `SameSite=Strict`
`HttpOnly` session cookie would work there too, and would keep the token out of
reach of JavaScript. Switching is one of this week's exercises.

### A small container image

```bash
bun run build      # bun build src/main.ts --target=bun → dist/main.js (+ source map)
```

`bun build` bundles the application **and all its dependencies** into one
file. The image therefore needs nothing but Bun and that file: no
`node_modules`, no install step, no lockfile in the image.

```dockerfile
FROM oven/bun:1.4-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY dist/ ./dist/
USER bun                     # never run as root
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "fetch('http://localhost:8000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["bun", "dist/main.js"]
```

`.dockerignore` sends only `dist/` to Docker, so `.env` (secrets!) and the
source can never end up in the image. Two runtime details in `main.ts`:

- **`/api/health`** answers `200` when the process is up. Docker calls it every
  15 seconds (`HEALTHCHECK`); the request logger skips it, so the log shows
  only real requests.
- **`SIGTERM`**: `docker compose down` and every redeployment stop containers
  with SIGTERM. The handler stops accepting connections, lets requests finish,
  closes the database pool, then exits.

**The image is built on the server.** `docker compose up --build` builds both
images on the server itself, for its own CPU architecture. A laptop with Apple
Silicon (ARM) and an x86 server never have to agree on anything. (Building an
`linux/amd64` image on an ARM Mac and *running* it there fails: Bun needs CPU
instructions that Docker's emulation does not provide.)

An alternative is `bun build --compile`, which produces a single executable that
contains Bun itself and could run on a distroless base image.

---

## Deploying to a cloud server

The plan: build everything on your laptop with one command, copy one folder to
the server, start it with one command. Hetzner and DigitalOcean are both
described; pick one. The steps after "create the server" are identical.

You need: an account at [Hetzner Cloud](https://www.hetzner.com/cloud) or
[DigitalOcean](https://www.digitalocean.com) (a payment method is required),
an SSH client (built into macOS, Linux and Windows 10+), Bun and this
repository.

### 0. Optional: try the production stack on your laptop

The same stack runs locally with Docker Desktop, on `http://localhost` (Caddy
serves plain HTTP for an `http://` address, and browsers allow Web Crypto on
`localhost`). Port 80 on your laptop must be free:

```bash
bun week-12/deploy/prepare.ts http://localhost
cd week-12/deploy/out && docker compose up -d --build
```

Open <http://localhost>, register with the `INVITE_CODE` from `out/.env`, and
try everything. Then remove it, *including* the generated `out/` folder, so the
real deployment gets its own secrets:

```bash
docker compose down -v && cd .. && rm -rf out
```

### 1. An SSH key

You log in to the server with a key pair instead of a password.

```bash
ssh-keygen -t ed25519 -C "awa-2026"      # accept the default file; a passphrase is a good idea
cat ~/.ssh/id_ed25519.pub                # the PUBLIC key: this is what you upload
```

The private key (`id_ed25519`, without `.pub`) never leaves your laptop.

### 2. Create the server

**Hetzner Cloud** ([Console](https://console.hetzner.com)):

1. Create a project, then *Add Server*.
2. **Location**: one close to your users (Helsinki, Falkenstein, Nuremberg, …).
3. **Image**: the *Apps* tab → **Docker CE** (Ubuntu with Docker and the
   Compose plugin preinstalled).
4. **Type**: the smallest *shared vCPU* type with at least 2 GB of RAM is plenty.
5. **Networking**: keep **public IPv4** enabled (Let's Encrypt and many networks
   still need it).
6. **SSH keys**: add the public key from step 1.
7. **Firewalls**: create one that allows incoming **TCP 22, 80, 443** and
   **UDP 443** (HTTP/3), and attach it.
8. Create, and note the server's **IPv4 address**.

**DigitalOcean** ([Control Panel](https://cloud.digitalocean.com)):

1. *Create* → *Droplets*.
2. **Region**: one close to your users (Amsterdam, Frankfurt, London, …).
3. **Image**: the *Marketplace* tab → **Docker** (Ubuntu with Docker and the
   Compose plugin preinstalled).
4. **Size**: *Basic*, a *Regular* plan with at least 2 GB of RAM.
5. **Authentication**: *SSH Key*, add the public key from step 1.
6. Create, and note the Droplet's **IPv4 address**.
7. *Networking* → *Firewalls* → create one that allows inbound **TCP 22, 80,
   443** and **UDP 443**, and apply it to the Droplet.

Both bill only for the time the server exists, up to a monthly maximum, but a
server that is merely powered off is **still billed**. Delete it when you no
longer need it (step 9).

**Why the provider's firewall, not `ufw` on the server?** Docker writes its own
packet-filter rules, and ports published by containers bypass `ufw` completely.
A firewall in front of the server (the provider's) cannot be bypassed that way.

### 3. Connect and check

```bash
ssh root@<server-ip>
docker version && docker compose version     # both should answer
exit
```

The first connection asks you to confirm the server's fingerprint; type `yes`.
(On a plain Ubuntu image instead of the Docker one, install Docker by following
<https://docs.docker.com/engine/install/ubuntu/>.)

### 4. A name for the server

Let's Encrypt issues certificates for **host names**, not bare IP addresses.

- **No domain?** Use [sslip.io](https://sslip.io): every name that contains an IP
  address resolves to that address. For the server `203.0.113.10`:
  `vault.203-0-113-10.sslip.io`. Nothing to register or configure.
  (`nip.io` is the same service, if one of them is rate-limited.)
- **Own domain?** Create a DNS **A record**, e.g. `vault.example.com` →
  `<server-ip>`, at your domain's DNS provider (Hetzner and DigitalOcean both
  offer free DNS hosting too).

Check that the name points at the server before continuing:

```bash
nslookup vault.203-0-113-10.sslip.io         # must print the server's IP
```

### 5. Build and prepare the deployment

On your laptop, in the repository root:

```bash
bun week-12/deploy/prepare.ts https://vault.203-0-113-10.sslip.io
```

`prepare.ts`:

1. bundles the API (`bun run build` in the API project);
2. builds the client with `BUN_PUBLIC_API_URL` set to that address;
3. assembles `week-12/deploy/out/`:

   ```
   out/
   ├── compose.yml        the stack
   ├── schema.sql         the tables, created on the database's first start
   ├── .env               generated secrets (see below)
   ├── api/               Dockerfile + the bundle
   └── web/               Dockerfile + Caddyfile + the built client
   ```

4. on its first run, writes `out/.env` with **fresh random secrets**: the
   database password, `JWT_SECRET`, the object storage keys and an
   `INVITE_CODE`. Later runs never overwrite it, because new secrets would lock
   the API out of the existing database.

`out/` is git-ignored. Keep a copy of `out/.env` somewhere safe (a password
manager): it holds the only copy of the database password.

### 6. Copy it to the server and start

```bash
rsync -a --delete week-12/deploy/out/ root@<server-ip>:vault/
ssh root@<server-ip>
cd vault
docker compose up -d --build                 # builds both images, starts everything
docker compose ps                            # all four services "Up", three of them "(healthy)"
docker compose logs caddy | grep -i certificate   # "certificate obtained successfully"
```

`rsync` must exist on both ends (`apt install rsync` on the server if it is
missing). Windows without WSL has no `rsync`; for the first upload use
`scp -r week-12/deploy/out root@<server-ip>:vault` instead.

Open `https://vault.203-0-113-10.sslip.io`: a padlock, and the login page.

### 7. Verify

- [ ] The site loads over HTTPS with a valid certificate; `http://` redirects to `https://`.
- [ ] Refreshing `/login` still shows the app (SPA fallback).
- [ ] Registering with the `INVITE_CODE` from `.env` works (database reachable).
- [ ] Onboarding works, and the key unlocks the dashboard (Web Crypto: secure context).
- [ ] Uploading works, and downloading returns the original file (object storage reachable).
- [ ] `docker compose logs api` shows your requests; six wrong passwords in a row give `429` (the rate limit works behind the proxy).
- [ ] From your laptop, `nc -vz <server-ip> 5432` and `nc -vz <server-ip> 8000` fail: only 80/443 are open.

### 8. Operating it

**Deploying a new version.** Change the code, then:

```bash
bun week-12/deploy/prepare.ts https://vault.203-0-113-10.sslip.io     # same address
rsync -a --delete week-12/deploy/out/ root@<server-ip>:vault/
ssh root@<server-ip> "cd vault && docker compose up -d --build"
```

Compose rebuilds the images and replaces only the containers whose image or
configuration changed. The volumes, and so the data, stay.

**Changing configuration.** Edit `out/.env` on your laptop, sync it, and run
`docker compose up -d`: containers whose environment changed are recreated.
(`docker compose restart` does *not* re-read `.env`.)

**Changing the schema.** `schema.sql` runs only when the database volume is
first created. Later changes are *migrations*: run them by hand, e.g.

```bash
docker compose exec -T postgres psql -U vault -d vault < migration.sql
```

**Logs and state.**

```bash
docker compose ps                        # what runs, and is it healthy?
docker compose logs -f api               # follow the API's log (Ctrl+C to stop)
docker compose logs --since 1h caddy     # the last hour of Caddy's log
docker stats                             # CPU and memory per container
```

**Backups.** Copy the database off the server regularly, and test that you
can restore it:

```bash
ssh root@<server-ip> "cd vault && docker compose exec -T postgres pg_dump -U vault vault" > vault-$(date +%F).sql
```

The encrypted files live in the `object-storage-data` volume. The simplest
complete backup is the provider's own: Hetzner *Backups* / DigitalOcean
*Backups* snapshot the whole server daily for a surcharge. Or move the files to
managed object storage (next section), which is replicated by the provider.

**Updates.** Ubuntu installs security updates automatically by default
(`unattended-upgrades`; check with `systemctl status unattended-upgrades`).
Kernel updates need a reboot from time to time (`reboot`; the containers come
back by themselves). Newer versions of the images the stack is built from:

```bash
docker compose pull --ignore-buildable     # postgres, seaweedfs
docker compose build --pull                # api and web, on newer oven/bun and caddy images
docker compose up -d
```

### Optional: the provider's object storage

Instead of SeaweedFS on the server, the files can go to the provider's managed,
replicated S3 storage. Both charge a monthly base price that includes plenty
of storage and traffic for a course project; check their pricing pages.

**Hetzner Object Storage**: Console → *Object Storage* → *Create Bucket*
(location, a globally unique name, *private*). Then *Security* → *S3
credentials* → *Generate credentials*, and save both keys immediately: the
secret is shown only once.

**DigitalOcean Spaces**: *Create* → *Spaces Object Storage* (region, a unique
name). Then create an *access key* for Spaces (*Spaces Object Storage* →
*Access Keys*) and save both keys.

Edit `out/.env`: **delete** the `COMPOSE_PROFILES` line and replace the `S3_*`
lines. For Hetzner (a bucket in `fsn1`):

```bash
S3_ENDPOINT=https://fsn1.your-objectstorage.com
S3_REGION=fsn1
S3_VIRTUAL_HOSTED_STYLE=true
S3_BUCKET=<your-bucket>
S3_ACCESS_KEY_ID=<access-key>
S3_SECRET_ACCESS_KEY=<secret-key>
```

For DigitalOcean (a Space in `fra1`):

```bash
S3_ENDPOINT=https://fra1.digitaloceanspaces.com
S3_REGION=us-east-1
S3_VIRTUAL_HOSTED_STYLE=true
S3_BUCKET=<your-space>
S3_ACCESS_KEY_ID=<access-key>
S3_SECRET_ACCESS_KEY=<secret-key>
```

Sync and run `docker compose up -d`; the API checks the bucket on startup, so
`docker compose logs api` tells you right away whether the settings are right.
If SeaweedFS was already running, stop it with
`docker compose rm -sf object-storage`. Files uploaded before the switch stay
in the old storage; copying them over is a job for an S3 tool such as
[rclone](https://rclone.org/s3/).

### Troubleshooting

| Symptom | Likely cause |
| ------- | ------------ |
| Browser: certificate error; Caddy log: `challenge failed` / `timeout` | Ports 80/443 not open in the provider's firewall, or the name does not resolve to the server (`nslookup`) |
| Caddy log mentions a rate limit | Let's Encrypt limit for the shared domain: switch `sslip.io` ↔ `nip.io` in the address, or use your own domain |
| `crypto.subtle` is undefined / "generateKey" errors | The page was opened over plain `http://` (an IP address): Web Crypto needs HTTPS |
| `api` keeps restarting or is `unhealthy` | `docker compose logs api`: a missing variable is reported by name, a storage problem as `Cannot use bucket …` |
| `Cannot use bucket …` | Wrong endpoint, keys, region or bucket name, or the addressing style (`S3_VIRTUAL_HOSTED_STYLE`) |
| `password authentication failed for user "vault"` | `POSTGRES_PASSWORD` changed after the first start; the password is set only when the volume is created |
| The site calls `localhost:8000` | The client was built without `prepare.ts`, so `BUN_PUBLIC_API_URL` was not set |
| Requests fail with a CORS error | The address in the browser differs from `PUBLIC_URL` (e.g. `http` vs `https`, `www.` vs none) |
| Changed `.env`, nothing happened | Use `docker compose up -d`, not `restart` |
| Everyone gets `429` after a few logins | `TRUST_PROXY` is not `true`: all requests look like they come from Caddy's IP |

### 9. Clean up

When the course is over: in the console, **delete the server** (and the
bucket, if you created one). Only deleting stops the billing. Delete the
firewall and the SSH key too if you like; they cost nothing.

### Before calling it production

This setup is real, but small. A production service would add: a non-root
user for SSH logins (and `PermitRootLogin no`); off-site, automated, *tested*
backups; monitoring and an uptime check that alerts someone; a CI/CD pipeline
that tests, builds and deploys on every merge; a staging server to try changes
first; and, once one server is not enough, a managed database and several API
containers behind a load balancer.

## Compared with last year's Deno version

- **No proprietary cloud.** Last year deployed to Azure (Container Apps, Static
  Web Apps, Blob Storage, PostgreSQL Flexible Server, a container registry).
  This year the same concepts (a container image, object storage, configuration
  through the environment, managed TLS) run on one ordinary Linux server with
  open-source parts, at any provider.
- Bun's built-in `S3Client` replaces the Azure SDK; SeaweedFS replaces the Azure
  emulator for local development and can run in production too.
- `Bun.password`; the Docker image runs a single bundled file as a non-root user
  with a health check (last year: `denoland/deno` with seven `--allow-*` flags,
  as root).
- Bun's bundler with `env: "BUN_PUBLIC_*"` (the client's `build.ts`) replaces
  Vite's `VITE_*` variables.
- Fixed: the SPA fallback (deep links returned 404); malformed JSON → `400`; the
  fingerprint can be set once (`409`, atomically in SQL); `JWT_SECRET` and
  `ALLOWED_ORIGIN` are required; the storage is checked once at startup;
  timestamps are `timestamptz`; a failed metadata insert removes its object.
- New: rate-limited login (week 11) that works behind a proxy, a constant-time
  invite-code check, a health endpoint and graceful shutdown, the key checked
  against the account the moment it is pasted, RESTful file URLs
  (`DELETE /api/files/:id`, `GET /api/files/:id/content`), integration tests
  with real encryption, and a one-command deployment (`prepare.ts`).

## Exercises

1. **Key rotation.** Let a user switch to a new key: download and decrypt every
   file with the old key, encrypt with the new one, upload, then update the
   fingerprint. What happens if the browser tab closes halfway?
2. **Sharing.** How could a user share one file with another user without the
   server ever seeing the file key? (Research: wrapping a per-file key with the
   recipient's public key, `RSA-OAEP` or `ECDH` in Web Crypto.)
3. **Streaming.** Files are held in memory completely. Where in the client and
   the API would that hurt with 2 GB files, and what would chunked encryption
   change?
4. **Cookies.** Replace the Bearer token with week 10's `HttpOnly` session
   cookie. Why does it work in production (one origin) without
   `SameSite=None`? What do you need in development, where client and API run
   on different ports?
5. **Backups.** Schedule a nightly `pg_dump` on the server (a `cron` job or a
   systemd timer) that keeps the last 7 dumps, copy them off the server, and
   restore one into a fresh database to prove it works.
6. **CI/CD.** Write a GitHub Actions workflow that runs `bun test` against
   service containers (PostgreSQL, SeaweedFS) and, on the `main` branch, runs
   `prepare.ts`, syncs `out/` (without `.env`) to the server over SSH with a
   deploy key, and runs `docker compose up -d --build`.

## Further reading

- [MDN: SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto), [AES-GCM parameters](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams) and [secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)
- [Bun: S3 client](https://bun.sh/docs/api/s3), [Docker guide](https://bun.sh/guides/ecosystem/docker), [bundler environment variables](https://bun.sh/docs/bundler#env)
- [Caddy: automatic HTTPS](https://caddyserver.com/docs/automatic-https) and [the Caddyfile](https://caddyserver.com/docs/caddyfile)
- [Docker Compose](https://docs.docker.com/compose/) and [Docker with firewalls (`ufw`)](https://docs.docker.com/engine/network/packet-filtering-firewalls/)
- [Hetzner Cloud docs](https://docs.hetzner.com/cloud/) and [Hetzner Object Storage](https://docs.hetzner.com/storage/object-storage/)
- [DigitalOcean Droplets](https://docs.digitalocean.com/products/droplets/) and [Spaces](https://docs.digitalocean.com/products/spaces/)
- [SeaweedFS](https://github.com/seaweedfs/seaweedfs), [sslip.io](https://sslip.io)
- [The Twelve-Factor App](https://12factor.net/)
