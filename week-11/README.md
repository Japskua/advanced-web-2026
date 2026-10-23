# Week 11 – Building secure applications: the OWASP Top 10

This week is about breaking things. The **Secure Application** demo comes in
two versions with the same endpoints: a **vulnerable** one (port 8000) full of
classic mistakes, and a **secure** one (port 8001) that fixes each of them. One
demo console in the browser can target either API, so every attack can be run
twice: once successfully, once blocked.

The code does not need to be written during the lecture. The lecture reads it,
attacks it, and compares the two versions.

> ⚠️ Never deploy the vulnerable version anywhere except your own machine.

## Learning objectives

After this week you can:

- name the OWASP Top 10:2025 categories and recognise them in code
- demonstrate and fix broken access control (role from the client, IDOR, missing authorisation)
- spot security misconfiguration: debug endpoints, leaky errors, permissive CORS
- explain why plain-text passwords and unsigned tokens are cryptographic failures
- exploit and fix SQL injection
- harden authentication: password policy, no user enumeration, rate limiting, signed tokens
- reason about software supply-chain risk and use Bun's protections against it
- explain why the client is never a security boundary

## The OWASP Top 10:2025

| # | Category | In this demo |
| - | -------- | ------------ |
| A01 | Broken Access Control | ✅ three cases |
| A02 | Security Misconfiguration | ✅ three cases |
| A03 | Software Supply Chain Failures | discussed below (Bun's install protections) |
| A04 | Cryptographic Failures | ✅ two cases |
| A05 | Injection | ✅ SQL injection |
| A06 | Insecure Design | discussion: most fixes here are design decisions |
| A07 | Authentication Failures | ✅ four cases |
| A08 | Software or Data Integrity Failures | discussion: unsigned tokens, unverified updates |
| A09 | Security Logging and Alerting Failures | discussion: the secure version logs errors server-side |
| A10 | Mishandling of Exceptional Conditions | ✅ leaky error handler (with A02) |

Introduce all ten briefly first; <https://owasp.org/Top10/> has a page per item.

## Running it

```bash
# repository root, once
docker compose up -d
bun run setup:env             # creates each project's .env with a random JWT_SECRET

# terminal 1 – both APIs
cd week-11/secure-application-api
bun run db:setup              # resets BOTH databases to the demo data (run again after each demo)
bun run dev:vulnerable        # http://localhost:8000
# terminal 2
bun run dev:secure            # http://localhost:8001

# terminal 3 – the demo console
cd week-11/secure-application-client
bun run dev                   # http://localhost:5173
bun run cors-test             # http://localhost:5500 (a "malicious" page on another origin)

bun test                      # in the API folder: 27 tests (12 attacks succeed, 15 checks that they fail)
```

Both versions refuse to start while `JWT_SECRET` in `.env` is still the placeholder from `.env.example`:
`src/config.ts` checks it at startup, whichever mode you run. `bun run setup:env` writes a random secret, but it
never changes an existing `.env`. If you already copied `.env.example` by hand, replace the `JWT_SECRET=` line
yourself, for example with the output of
`bun -e 'console.log(crypto.getRandomValues(new Uint8Array(32)).toBase64())'`.

Seeded data (identical in both databases, except how passwords are stored):

| User | Password | Id | Note id |
| ---- | -------- | -- | ------- |
| `admin@example.com` (admin) | `Admin123!` | `11111111-1111-1111-1111-111111111111` | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` |
| `alice@example.com` | `alice123` | `22222222-2222-2222-2222-222222222222` | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` |
| `bob@example.com` | `bob123` | `33333333-3333-3333-3333-333333333333` | `cccccccc-cccc-cccc-cccc-cccccccccccc` |

## Project structure

```
week-11/
├── secure-application-api/
│   ├── sql/
│   │   ├── vulnerable-schema.sql    users.password (plain text)
│   │   └── secure-schema.sql        users.password_hash, role check constraint
│   ├── scripts/db-setup.ts          resets both databases
│   ├── src/
│   │   ├── main.ts                  --mode=vulnerable (8000) | --mode=secure (8001)
│   │   ├── config.ts, db.ts, seed.ts
│   │   ├── vulnerable/
│   │   │   └── app.ts               ⚠️ an Elysia app: every route, every mistake, labelled A01…A07
│   │   └── secure/
│   │       ├── app.ts               ✅ the same routes, fixed and labelled
│   │       ├── auth.ts              signed JWTs, user loaded from the database
│   │       └── rate-limiter.ts      fixed-window limiter for failed logins
│   └── tests/
│       ├── vulnerable.test.ts       each attack succeeds
│       └── secure.test.ts           each attack fails
└── secure-application-client/
    ├── src/App.tsx                  the demo console (choose the target API)
    └── CORS-test.html               served on another origin by `bun run cors-test`
```

Compare the two versions directly:

```bash
cd week-11/secure-application-api
git diff --no-index src/vulnerable/app.ts src/secure/app.ts
```

---

## The client is not a security boundary

The demo console looks harmless, but everything it does is a plain HTTP
request. Every attack below can be repeated with `curl`, and attackers never
use your front-end. Validation, authentication and authorisation that exist
only in the client do not exist.

---

## A01 – Broken Access Control

**1. Trusting the client's claim about its role.**
`GET /api/admin/audit?role=admin`

```ts
// vulnerable
.get("/api/admin/audit", ({ query, status }) => {
  if (query.role !== "admin") return status(403, { ok: false, error: "Forbidden" });
  …
})
```

```bash
curl "http://localhost:8000/api/admin/audit?role=user"     # 403
curl "http://localhost:8000/api/admin/audit?role=admin"    # 200, secret logs
```

Fix: the role comes from the authenticated user's database record; anything in
the request is ignored.

```ts
// secure
.get("/api/admin/audit", () => ({ ok: true, data: … }), { role: "admin" })   // the macro checks the token and the role
```

**2. IDOR / BOLA: reading someone else's object by changing an id.**
Log in as Alice, then request Bob's note:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/login -H "content-type: application/json" \
  -d '{"email":"alice@example.com","password":"alice123"}' | bun -e 'console.log(JSON.parse(await Bun.stdin.text()).data.token)')
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/notes/cccccccc-cccc-cccc-cccc-cccccccccccc
```

"Insecure Direct Object Reference" (also called Broken Object Level
Authorization, the #1 API risk): authentication alone says *who* you are, not
*what you may access*. Fix: check ownership on every object access.

```ts
if (!note || (note.owner_id !== user.id && user.role !== "admin")) {
  return status(404, { ok: false, error: "Note not found" });   // 404, not 403: don't confirm it exists
}
```

**3. No authorisation at all.** `DELETE /api/users/:id` deletes anyone's
account without even a token:

```bash
curl -X DELETE http://localhost:8000/api/users/33333333-3333-3333-3333-333333333333
```

Fix: the route option `{ role: "admin" }` (an Elysia macro, as in week 8).

## A02 – Security Misconfiguration

**1. A debug endpoint in production.** `GET /api/debug/config` returns the
database URL with its password, a secret, the Bun version and the server's
directory. Fix: debug tooling never ships; the route does not exist in the
secure version (`404`).

**2. Leaky error messages.** Registering an existing email makes the vulnerable
API answer with the database error, the constraint name and a stack trace,
which is free reconnaissance for an attacker:

```bash
curl -X POST http://localhost:8000/api/register -H "content-type: application/json" \
  -d '{"email":"alice@example.com","password":"whatever"}'
```

Fix: log details on the server, return `{"error":"Internal server error"}`
(the app's `onError` hook, as in week 8's error handler). This is also **A10
Mishandling of Exceptional Conditions**: failing *safely* is part of the design.

**3. Permissive CORS.** `Access-Control-Allow-Origin: *` lets any website read
the API's responses through its visitors' browsers. Run `bun run cors-test`
and open <http://localhost:5500>: the page (on another origin, standing in for a
malicious site) reads the vulnerable API's debug data, while the browser blocks
it from reading the secure API, which allows only `http://localhost:5173`.

CORS is enforced by browsers. It protects users from other websites; it does
not protect the API from `curl` or scripts.

The secure version also adds `X-Content-Type-Options: nosniff` and
`Cache-Control: no-store` to every response.

## A04 – Cryptographic Failures

**1. Plain-text passwords.** Look at the two databases:

```bash
docker exec -it awa-postgres psql -U postgres -d secure_app_vulnerable -c "select email, password from users"
docker exec -it awa-postgres psql -U postgres -d secure_app_secure -c "select email, password_hash from users"
```

Fix: `Bun.password.hash()` (Argon2id: salted and deliberately slow, see week 7).

**2. A "token" that is just Base64-encoded JSON.** Log in on the vulnerable API
and decode the token in the browser console:

```js
JSON.parse(atob("<token>"))   // { userId, email, role }
```

Encoding is not encryption, and certainly not a signature. Change `role` to
`"admin"`, encode it again with `btoa(JSON.stringify(…))`, and the API accepts
it. One test does exactly this to read the admin's note without logging in.
Fix: a signed JWT (`jose`, HS256); any change to the payload breaks the
signature.

## A05 – Injection

`GET /api/users/search?email=…` builds SQL by concatenating strings:

```ts
// vulnerable
const query = `select id, email, role, password from users where email = '${email}'`;
const rows = await sql.unsafe(query);
```

Enter `' OR '1'='1` in the console's search box (or):

```bash
curl "http://localhost:8000/api/users/search?email=%27%20OR%20%271%27%3D%271"
```

The query becomes `… where email = '' OR '1'='1'`, true for every row, so it
returns every user with their password. Worse inputs could read other tables
(`' UNION SELECT …`) or change data.

Fix: parameterised queries, as we have used since week 6:

```ts
// secure
const rows = await sql`select id, email, role from users where email = ${email}`;
```

The tagged template sends the value separately from the SQL text, so it can
never change the query's structure. `sql.unsafe()` exists for SQL that you
write yourself (like the schema files); never pass user input to it. The fix
also drops the password column, removes `executedQuery` from the response, and
requires a login, since an anonymous user directory is an enumeration tool too.

## A07 – Authentication Failures

**1. Weak password policy.** The vulnerable API accepts `abcd`. Fix: at least
8 characters with upper- and lowercase letters, a number and a special
character (and, in production, a check against lists of breached passwords).

**2. User enumeration.** Unknown email → `404 User does not exist`; known email
with a wrong password → `401 Wrong password`. An attacker can now test a list
of emails to find real accounts. Fix: one answer for both, and the same work
for both: the secure login runs `Bun.password.verify` against a dummy hash for
unknown emails, so response *times* do not differ either.

**3. No brute-force protection.** Press "Brute force: 10 wrong passwords" in the
console. The vulnerable API answers all ten; tools such as
[Hydra](https://github.com/vanhauser-thc/thc-hydra) try thousands per minute.
The secure API answers `401` five times and then `429 Too Many Requests` with a
`Retry-After` header, even for the correct password, until the 15-minute
window ends (`secure/rate-limiter.ts`). The counter is keyed by IP address and
email.

A subtle detail: the attempt is counted *before* the password is checked, in
the same synchronous step as the limit check. Checking a password takes time
(Argon2 is slow on purpose); if failures were only recorded afterwards, an
attacker sending 100 guesses *in parallel* would get all 100 past the check
before the first failure was counted. A test fires 20 parallel guesses and
expects exactly 5 to reach the password check. Real deployments add protection further out: the cloud provider's WAF
and bot protection, CAPTCHAs, and multi-factor authentication.

**4. Trusting an unsigned token**: see A04.

## A03 – Software Supply Chain Failures (and what replaced Deno's permissions)

Last year's version of this lecture covered **Deno's permission model**: Deno
refuses network, file and environment access unless flags such as
`--allow-net` grant it. **Bun has no runtime permission system.** Like Node.js,
a Bun program (and every package it imports) can do anything your user account
can. That makes the code you *install* the main risk, which is exactly what
OWASP's A03 is about: malicious or compromised packages, typosquatting, and
install scripts.

What Bun does about it, and how this repository uses it:

| Protection | How |
| ---------- | --- |
| **No install scripts by default** | Bun does not run `postinstall` and other lifecycle scripts of dependencies unless the package is listed in `trustedDependencies` in `package.json`. `bun pm untrusted` lists packages whose scripts were blocked; `bun add --trust <pkg>` allows one. Many supply-chain attacks live in install scripts. |
| **Minimum release age** | The repository's `bunfig.toml` sets `[install] minimumReleaseAge = 259200` (3 days): `bun add`/`bun update` ignore versions younger than that. Most malicious releases of popular packages are detected and pulled within hours. (While building this course it blocked `@types/bun@1.4.3`, published the same morning, and the version ranges were adjusted. That is the trade-off in practice.) |
| **Lockfile** | `bun.lock` pins exact versions and integrity hashes. Commit it; use `bun install --frozen-lockfile` in CI so an install never silently changes it. |
| **Audit** | `bun audit` checks installed packages against the npm advisory database. |
| **Isolated installs** | This repository's workspaces use Bun's isolated linker: each project can import only the packages it declares. |

Without a sandbox, defence in depth comes from where the program runs: a
container with a read-only filesystem, a non-root user (week 12's Dockerfile),
no secrets beyond the ones the service needs, and restricted outbound network
access.

```bash
bun audit                 # repository root: known vulnerabilities
bun pm untrusted          # dependencies whose install scripts were blocked
bun outdated              # which dependencies have newer versions
```

## Lecture walkthrough

1. Introduce the OWASP Top 10:2025 at a high level.
2. Start both APIs and the console. Show that the console is just a facade:
   repeat a request with `curl`.
3. For each section (A01 → A02 → A04 → A05 → A07):
   1. run the attack against the vulnerable API (console or curl);
   2. read the vulnerable handler, find the mistake;
   3. read the secure handler;
   4. switch the console to the secure API and repeat the attack.
4. The CORS test page on port 5500.
5. A03: install-script blocking, `minimumReleaseAge`, `bun audit`, and the
   honest statement that Bun has no permission sandbox.
6. Show the two test suites as executable documentation of the attacks.
7. `bun run db:setup` between demos to restore deleted users.

## Compared with last year's Deno version

- Side-by-side `vulnerable/` and `secure/` files, both runnable at once, instead
  of commenting code in and out during the lecture.
- Rate limiting is implemented (it was only discussed).
- The secure version's seed data uses hashes, so the seeded users can log in to
  both versions (last year's secure mode could not log them in).
- 27 automated tests prove each vulnerability and each fix, including a burst
  of parallel login attempts against the rate limiter.
- The "Deno permission model" topic is replaced by A03 supply-chain security
  with Bun's install protections.
- `CORS-test.html` is served by Bun itself (`bun run cors-test`); no VS Code
  Live Server needed.

## Exercises

1. Find one more vulnerability in `vulnerable/app.ts` that is not labelled.
   (Hint: what happens with a malformed note id?)
2. Add an account lockout notification: after 5 failed logins, log a warning
   with the IP and email (A09). What must the log *not* contain?
3. The rate limiter is in memory. What happens with three instances of the API
   behind a load balancer? Sketch a Redis-based version.
4. Add `GET /api/notes` that lists the caller's own notes in the secure version,
   with a test that Alice never sees Bob's notes.
5. Run `bun audit` on your project work, and set `minimumReleaseAge` in its
   `bunfig.toml`.

## Further reading

- [OWASP Top 10:2025](https://owasp.org/Top10/)
- [OWASP API Security Top 10](https://owasp.org/API-Security/) (BOLA is #1)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) – Authentication, Authorization, SQL Injection Prevention, Error Handling
- [PortSwigger Web Security Academy](https://portswigger.net/web-security) – free interactive labs for every attack shown here
- [Bun: Lifecycle scripts and trustedDependencies](https://bun.sh/docs/pm/lifecycle)
- [Bun: bunfig.toml install settings](https://bun.sh/docs/runtime/bunfig)
