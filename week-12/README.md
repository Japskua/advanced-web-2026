# Week 12 – Full-stack deployment to Azure: the Encrypted File Vault

The last application brings the course together and puts it **in the cloud**.
The **Encrypted File Vault** lets users store files that nobody else can read:
files are encrypted **in the browser** with a key that never leaves the user's
hands, and only ciphertext is uploaded. The API keeps metadata in
**PostgreSQL** and the encrypted bytes in **Azure Blob Storage**.

Everything runs locally first (PostgreSQL and the Azurite storage emulator in
Docker). Then the same code is deployed to Azure: the API as a **container**
on Azure Container Apps, the client on **Azure Static Web Apps**, the database
on **Azure Database for PostgreSQL**, the files in a **Storage Account**.

## Learning objectives

After this week you can:

- encrypt and decrypt files in the browser with the Web Crypto API (AES-GCM), and explain the role of the key, the IV and the authentication tag
- design a system in which the server never sees plaintext, and state its trade-offs (lost key = lost files)
- store files in object storage (Azure Blob Storage) instead of the server's disk, and develop against an emulator
- configure an application per environment: runtime variables for the API, build-time variables for the client
- package a Bun API as a small container image, run as non-root, with a health check and graceful shutdown
- deploy a full-stack application to Azure and debug the usual problems (CORS, TLS, SPA routing)
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
7. The API checks that the fingerprint matches the account, stores the ciphertext in Blob Storage under
   `<user id>/<file id>`, and the metadata in PostgreSQL.

**Downloading and deleting**

8. The browser downloads the ciphertext of one of *its own* files and decrypts it locally with the key and the stored IV.
9. Deleting removes the metadata row, then the blob.

**What the server knows.** Email, password hash, key fingerprint, file names,
sizes and types, and ciphertext. Not the key, and not the contents of any file.
Someone with full access to the Azure account cannot read the files. The flip
side: if a user loses their key, their files are gone for good.

## API

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/api/health` | – | health check for Azure |
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
# repository root, once: PostgreSQL (database file_vault) and Azurite (blob storage)
docker compose up -d

# terminal 1
cd week-12/encrypted-file-vault-api
cp .env.example .env              # set JWT_SECRET; the rest works with docker compose as it is
bun run db:setup
bun run dev                       # http://localhost:8000 (creates the blob container on startup)
bun test                          # 13 integration tests: real AES-GCM, PostgreSQL, Azurite

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
│   ├── Dockerfile, .dockerignore     the container image (bundle + Bun, non-root)
│   ├── sql/schema.sql                users (key_fingerprint), files (blob_name, encryption_iv)
│   └── src/
│       ├── main.ts                   ensureContainer(), Bun.serve, SIGTERM handling
│       ├── config.ts                 every setting from the environment
│       ├── routes.ts                 the route table (+ /api/health)
│       ├── handlers/                 auth-handlers (rate-limited login), file-handlers
│       ├── services/
│       │   ├── auth-service.ts       invite code, hashing, onboarding
│       │   ├── file-service.ts       fingerprint check, upload/download/delete
│       │   └── blob-storage.ts       Azure Blob Storage (Azurite locally)
│       ├── repositories/             users, files (every file query includes the owner)
│       ├── middleware/               auth (withAuth), logger, middleware
│       ├── errors.ts, mappers.ts, types.ts
│       └── util/                     jwt, rate-limiter (from week 11), response, validation
└── encrypted-file-vault-client/
    ├── bunfig.toml                   inline BUN_PUBLIC_* variables in development
    ├── .env.example                  BUN_PUBLIC_API_URL
    ├── staticwebapp.config.json      SPA fallback + security headers for Azure Static Web Apps
    └── src/
        ├── config.ts                 API_URL from the build
        ├── crypto.ts                 generateKey, importKey, fingerprintOf, encryptFile, decryptBytes
        ├── api.ts                    requests + the token store
        ├── auth/                     AuthContext, AuthProvider, useAuth
        ├── encryption/               EncryptionKeyContext, EncryptionKeyProvider, useEncryptionKey
        ├── components/               RouteGuards, KeyManager, FileUploadForm, FileList, AuthPageLayout
        └── pages/                    Login, Register, Onboarding, Dashboard
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

### Object storage instead of the server's disk

Week 5 wrote uploads into a folder. In the cloud that fails: a container's
filesystem disappears when the container is replaced (every deployment), and
two replicas would each have their own files. **Object storage** (Azure Blob
Storage, AWS S3, Google Cloud Storage) is a separate, durable service: files are
*blobs* in a *container*, addressed by name, reachable from every replica.

```ts
const container = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING)
  .getContainerClient("encrypted-files");

await container.getBlockBlobClient(`${userId}/${fileId}`).uploadData(bytes);
const buffer = await container.getBlockBlobClient(name).downloadToBuffer();
```

Locally, **Azurite** (in `docker-compose.yml`) implements the same API, and
the connection string `UseDevelopmentStorage=true` points the SDK at it, so the
code does not change between laptop and cloud. Microsoft's SDK runs on Bun
as it is. (Bun also has a *built-in* client for S3-compatible storage,
`Bun.s3`; Azure Blob Storage uses a different protocol, hence the SDK.)

The upload writes the blob first and the row second, deleting the blob if the
row fails; delete removes the row first (week 6's reasoning).

### Configuration per environment

The same code runs on a laptop and in Azure; only configuration changes.

| | API (server) | Client (static files) |
| - | ------------ | --------------------- |
| When is config read? | at **runtime**, on every start | at **build time**, baked into the JS |
| Local | `.env` (loaded by Bun) | `.env` + `bunfig.toml` |
| Azure | Container App environment variables / secrets | `BUN_PUBLIC_API_URL=… bun run build` |
| Can hold secrets? | yes | **never**: anyone can read the bundle |

The client has no server to read variables at runtime, so Bun's bundler
replaces `process.env.BUN_PUBLIC_API_URL` with its value while building. Only
variables with the `BUN_PUBLIC_` prefix are inlined (`--env='BUN_PUBLIC_*'`), so
a secret in the environment cannot leak into the bundle by accident.
`config.ts` falls back to `localhost:8000` if the variable was not set.

The API reads every variable in `config.ts` and refuses to start if one is
missing. In particular, `ALLOWED_ORIGIN` has no `*` default: production must
name the client's exact URL.

### Why a token and not a session cookie this time

Week 10 argued for `HttpOnly` cookies. In this deployment the client runs on
`…azurestaticapps.net` and the API on `…azurecontainerapps.io`: different
**sites**. A cookie would have to be `SameSite=None; Secure` to be sent at all,
and browsers increasingly block such third-party cookies. A Bearer token in the
`Authorization` header works across sites. With a custom domain for both
(`vault.example.com`, `api.vault.example.com`) cookies would become an option
again. Architecture and security choices depend on the deployment.

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
CMD ["bun", "dist/main.js"]
```

`.dockerignore` sends only `dist/` to Docker, so `.env` (secrets!) and the
source can never end up in the image. Two runtime details in `main.ts`:

- **`/api/health`** answers `200` when the process is up; Azure can use it as a
  health probe.
- **`SIGTERM`**: platforms stop containers with SIGTERM (new revision, scaling
  in). The handler stops accepting connections, lets requests finish, then exits.

An alternative is `bun build --compile`, which produces a single executable that
contains Bun itself and could run on a distroless base image.

**Running the container locally.** Inside a container, `localhost` is the
container itself, so the services on your machine are reached through
`host.docker.internal`, and Azurite needs its full connection string (the
account name and key below are Azurite's public, documented development values):

```bash
bun run build && docker build -t vault-api .
docker run --rm -p 8000:8000 \
  -e DATABASE_URL=postgres://postgres:postgres@host.docker.internal:5432/file_vault \
  -e JWT_SECRET="$(bun -e 'console.log(crypto.getRandomValues(new Uint8Array(32)).toBase64())')" \
  -e INVITE_CODE=AWA2026 -e ALLOWED_ORIGIN=http://localhost:5173 \
  -e "AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://host.docker.internal:10000/devstoreaccount1;" \
  vault-api
curl http://localhost:8000/api/health
```

**Apple Silicon note.** Azure runs `linux/amd64`. Build for Azure with
`--platform linux/amd64`, but do not try to *run* that image on an ARM Mac:
under Docker's CPU emulation Bun crashes (it needs instructions the emulator
does not provide). To test locally, build without `--platform` (native arm64).

### Static Web Apps and client-side routing

Azure Static Web Apps serves `dist/` as plain files. Refreshing
`https://…/login` asks for a file called `login`, which does not exist. The
React Router app needs every unknown path to return `index.html`:
`staticwebapp.config.json` (copied into `dist/` by the build script) sets that
`navigationFallback` and some security headers. Last year's deployment lacked
it, so deep links returned 404.

---

## Deploying to Azure

A manual deployment through the Azure Portal, for learning; production would
script it (Bicep/Terraform) and run it from CI. Use the **same region** for
everything (e.g. *Sweden Central* or *West Europe*).

You need: an Azure subscription (Azure for Students works), Docker Desktop,
the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
(`az`), and Bun.

### 1. Resource group

Portal → *Resource groups* → *Create*: e.g. `rg-awa-vault` in your region.
Everything below goes into it, so deleting it at the end deletes everything.

### 2. PostgreSQL

1. *Azure Database for PostgreSQL flexible server* → *Create*.
2. Resource group and region as above; the newest PostgreSQL version offered;
   workload type *Development*; compute *Burstable B1ms* (or the free tier if
   your subscription offers it).
3. Authentication: *PostgreSQL authentication only*. Choose an admin user and a
   strong password and store them.
4. Networking: *Public access*. Tick **Allow public access from any Azure
   service within Azure to this server** (so the Container App can connect),
   and **Add current client IP address** (so you can run the schema from your
   laptop). Create.
5. After deployment: *Databases* → *Add* → `file_vault`.
6. Apply the schema from your laptop:

   ```bash
   cd week-12/encrypted-file-vault-api
   DATABASE_URL='postgres://<admin>:<password>@<server>.postgres.database.azure.com:5432/file_vault?sslmode=require' \
     bun run db:setup
   ```

   Azure requires TLS: `?sslmode=require` turns it on in Bun's SQL client.
   Characters such as `@`, `:` or `/` in the password must be URL-encoded.

### 3. Storage account

1. *Storage accounts* → *Create*: same resource group and region, *Standard*
   performance, *LRS* redundancy. The name must be globally unique, lowercase.
2. After deployment: *Security + networking → Access keys* → copy a
   **connection string**.
3. The API creates the private container `encrypted-files` when it starts, so
   nothing else is needed. (*Data storage → Containers* shows it afterwards.)

### 4. Build and push the API image

1. *Container registries* → *Create*: a globally unique name, *Basic* SKU.
2. Build and push:

   ```bash
   cd week-12/encrypted-file-vault-api
   bun run build
   az login
   az acr login --name <registry>
   docker build --platform linux/amd64 -t <registry>.azurecr.io/vault-api:1.0 .
   docker push <registry>.azurecr.io/vault-api:1.0
   ```

   Use a new tag (`1.1`, `1.2`, …) for every new version, so it is always clear
   which code runs where.

### 5. Container App (the API)

1. *Container Apps* → *Create*. Create a new *Container Apps environment* in
   the same region (zone redundancy off; for this demo, logs may be off).
2. Container: image source *Azure Container Registry*, your registry, image
   `vault-api`, tag `1.0`. Use a *system-assigned managed identity* to pull the
   image if the portal offers it. CPU/memory: `0.5` vCPU, `1 Gi`.
3. Ingress: enabled, *accepting traffic from anywhere*, target port `8000`,
   insecure connections disabled.
4. Environment variables: add all of them. Store the sensitive ones as
   **secrets** (*Settings → Secrets*) and reference them, instead of plain values:

   | Variable | Value |
   | -------- | ----- |
   | `DATABASE_URL` (secret) | `postgres://<admin>:<password>@<server>.postgres.database.azure.com:5432/file_vault?sslmode=require` |
   | `JWT_SECRET` (secret) | a new random value (not your local one) |
   | `AZURE_STORAGE_CONNECTION_STRING` (secret) | from step 3 |
   | `AZURE_STORAGE_CONTAINER_NAME` | `encrypted-files` |
   | `INVITE_CODE` | the code you give to users |
   | `TRUST_PROXY` | `true`: the ingress passes the client's IP in `X-Forwarded-For`, which the login rate limit needs |
   | `ALLOWED_ORIGIN` | temporarily `http://localhost:5173`; the Static Web App URL after step 6 |
   | `PORT` | `8000` |

5. Create. Then open the app's *Application Url* + `/api/health`: you should see
   `{"ok":true,"data":{"status":"up"}}`. If not, check *Monitoring → Log stream*:
   a missing variable is reported by name at startup.
6. Optional: *Application → Containers → Health probes*: liveness and readiness
   on HTTP path `/api/health`, port `8000`.

### 6. Static Web App (the client)

1. *Static Web Apps* → *Create*: plan *Free*, deployment source **Other** (we
   deploy from the command line). Create, then copy the app's **URL** and, under
   *Manage deployment token*, the **deployment token**.
2. Build the client against the deployed API and deploy it:

   ```bash
   cd week-12/encrypted-file-vault-client
   BUN_PUBLIC_API_URL=https://<container-app-url> bun run build
   bunx --bun @azure/static-web-apps-cli deploy ./dist --env production --deployment-token <token>
   ```

   (PowerShell: `$env:BUN_PUBLIC_API_URL="https://…"; bun run build`.)
   Check that the bundle contains the right URL:
   `grep -o "https://[a-z0-9.-]*azurecontainerapps.io" dist/*.js`.
3. Back in the Container App: set `ALLOWED_ORIGIN` to the Static Web App URL
   (exactly, without a trailing slash) and save. This creates a new revision.

### 7. Verify

- [ ] The Static Web App URL shows the login page; refreshing `/login` still works (SPA fallback).
- [ ] Registering with the invitation code works (database reachable).
- [ ] Onboarding works, and the key unlocks the dashboard.
- [ ] Uploading works: the blob appears in the storage account's `encrypted-files` container (download it: unreadable ciphertext).
- [ ] Downloading returns the original file.
- [ ] The browser console shows no CORS errors.

### Troubleshooting

| Symptom | Likely cause |
| ------- | ------------ |
| Container keeps restarting | A missing or wrong environment variable; read the log stream |
| `ECONNREFUSED`/timeout to PostgreSQL | Firewall: "allow Azure services" not ticked |
| `no pg_hba.conf entry … no encryption` | `?sslmode=require` missing from `DATABASE_URL` |
| CORS error in the browser | `ALLOWED_ORIGIN` ≠ the exact Static Web App origin (scheme, no trailing slash) |
| Client calls `localhost:8000` in production | `BUN_PUBLIC_API_URL` was not set when building |
| `404` after refreshing a page | `staticwebapp.config.json` missing from `dist/` |

### 8. Clean up

Delete the resource group when you are done. It removes every resource and
stops all costs:

```bash
az group delete --name rg-awa-vault
```

### Before calling it production

This deployment is a lab. A real one would add: private networking (VNet,
private endpoints) instead of public database access; **managed identities**
instead of connection strings for storage and the registry; secrets in **Key
Vault**; a custom domain; centralised logging and alerts; a CI/CD pipeline that
builds, tests and deploys on every merge; and backups with tested restores.

## Compared with last year's Deno version

- Bun's SQL client with `sslmode=require` (TLS to Azure); `Bun.password`; the
  Docker image runs a single bundled file as a non-root user (last year:
  `denoland/deno` with seven `--allow-*` flags, as root).
- `bun build --env='BUN_PUBLIC_*'` replaces Vite's `VITE_*` variables;
  `bunx --bun` runs the Static Web Apps CLI without Node.js.
- Fixed: SPA fallback for Static Web Apps; malformed JSON → `400`; the
  fingerprint can be set once (`409`, atomically in SQL); `JWT_SECRET` and
  `ALLOWED_ORIGIN` are required; the blob container is created once at startup;
  timestamps are `timestamptz`; a failed metadata insert removes its blob.
- New: rate-limited login (week 11), a constant-time invite-code check, a health
  endpoint and graceful shutdown, the key checked against the account the moment
  it is pasted, RESTful file URLs (`DELETE /api/files/:id`,
  `GET /api/files/:id/content`), and integration tests with real encryption.

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
4. **CI/CD.** Write a GitHub Actions workflow that runs `bun test` against
   service containers (PostgreSQL, Azurite), builds and pushes the image, and
   deploys the client.

## Further reading

- [MDN: SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) and [AES-GCM parameters](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams)
- [Bun: Docker guide](https://bun.sh/guides/ecosystem/docker)
- [Bun: Bundler, environment variables](https://bun.sh/docs/bundler#env)
- [Azure Container Apps documentation](https://learn.microsoft.com/azure/container-apps/)
- [Azure Static Web Apps: configuration (`staticwebapp.config.json`)](https://learn.microsoft.com/azure/static-web-apps/configuration)
- [Azure Database for PostgreSQL: TLS connections](https://learn.microsoft.com/azure/postgresql/flexible-server/how-to-connect-tls-ssl)
- [Azurite emulator](https://learn.microsoft.com/azure/storage/common/storage-use-azurite)
- [The Twelve-Factor App](https://12factor.net/)
