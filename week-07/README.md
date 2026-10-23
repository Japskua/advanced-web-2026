# Week 7 – Authentication and authorization

**Secret Notes** has notes that only logged-in users may read. Users register
with an email and a password, log in, and receive a **JSON Web Token (JWT)**
that proves who they are on later requests. On the client, **React Router**
splits the app into pages and keeps logged-out users away from the protected
one.

## Learning objectives

After this week you can:

- store passwords safely with a salted, slow hash (`Bun.password`, Argon2id)
- explain what a JWT contains, why it cannot be forged, and why it can be read
- issue a JWT on login and verify it on protected routes (`401` when missing or invalid)
- turn a database constraint violation into a meaningful HTTP status (`409`)
- avoid revealing which emails have accounts
- build a multi-page React app with React Router: routes, links, redirects, protected routes, navigation state
- store a token in the browser, send it with requests, and handle its expiry

## What you build

| Method | Path | Auth | Body | Success | Errors |
| ------ | ---- | ---- | ---- | ------- | ------ |
| `POST` | `/api/auth/register` | – | `{ email, password }` | `201` `PublicUser` | `400` invalid input, `409` email taken |
| `POST` | `/api/auth/login` | – | `{ email, password }` | `200` `{ token, user }` | `401` invalid credentials |
| `GET` | `/api/notes` | Bearer token | – | `200` `Note[]` | `401` not authenticated |

Client pages: `/login`, `/register`, `/notes` (protected); `/` redirects to `/notes`.

## Running it

```bash
# repository root, once
docker compose up -d

# terminal 1
cd week-07/secret-notes-api
cp .env.example .env          # then put a real random value in JWT_SECRET (see the file)
bun run db:setup              # users and notes tables + three secret notes
bun run dev                   # http://localhost:8000
bun test                      # 13 tests

# terminal 2
cd week-07/secret-notes-client
bun run dev                   # http://localhost:5173
```

## Project structure

```
week-07/
├── shared/types.ts                   Note, PublicUser, Credentials, LoginResponse, ApiResult<T>
├── secret-notes-api/
│   ├── .env.example                  DATABASE_URL, JWT_SECRET
│   ├── sql/schema.sql                users, notes (+ seed notes)
│   └── src/
│       ├── config.ts                 required env vars; JWT_SECRET ≥ 32 characters
│       ├── router.ts                 register, login, notes handlers
│       ├── middleware/
│       │   └── auth-middleware.ts    signToken(), requireAuth()
│       ├── services/
│       │   └── auth-service.ts       register(), login(): hashing and checking passwords
│       ├── repositories/
│       │   ├── user-repository.ts    findUserByEmail(), createUser() (+ unique violation)
│       │   └── notes-repository.ts   listNotes()
│       └── util/                     response.ts (CORS + Authorization), validation.ts
└── secret-notes-client/src/
    ├── main.tsx                      <BrowserRouter>
    ├── App.tsx                       <Routes>
    ├── auth.ts                       token in localStorage
    ├── api.ts                        request<T>() adds "Authorization: Bearer …"
    ├── components/                   NavBar, ProtectedRoute
    └── pages/                        LoginPage, RegisterPage, NotesPage
```

---

## Concepts: the back-end

### Authentication vs. authorization

- **Authentication**: *who are you?* Proving identity, here with email and
  password, then with a token.
- **Authorization**: *what may you do?* This week the rule is simple: any
  authenticated user may read the notes. Week 8 adds roles.

The status codes follow the same split: **`401 Unauthorized`** means "not
authenticated" (despite its name), **`403 Forbidden`** means "authenticated, but
not allowed".

### Storing passwords: hashing with `Bun.password`

A password must never be stored as it is, and not encrypted either (anything
encrypted can be decrypted by whoever holds the key). It is stored as a
**hash**, the output of a one-way function:

```ts
const passwordHash = await Bun.password.hash(password);
// "$argon2id$v=19$m=65536,t=2,p=1$k3Jp…$Wq8u…"

const valid = await Bun.password.verify(password, user.passwordHash);
```

A password hash has to be:

- **salted**: a random value is mixed in for every password, so equal
  passwords get different hashes, and precomputed "rainbow tables" are useless.
- **slow**: Argon2id deliberately uses time and memory, so an attacker who
  steals the table can try only a handful of guesses per second per CPU core,
  not billions. Fast hashes such as SHA-256 are the wrong tool here.

`Bun.password` uses **Argon2id** by default (the current OWASP recommendation)
and supports bcrypt (`{ algorithm: "bcrypt" }`). The algorithm, its settings
and the salt are stored in the hash string itself, so `verify` needs nothing
else. It is built into Bun, so there is no library to install.

### Registering safely

```ts
if (await findUserByEmail(email)) throw new EmailTakenError();   // friendly check
...
await createUser(user);                                           // may still fail…
```

Two registrations with the same email arriving at the same moment can both pass
the first check. The `unique` constraint on `users.email` guarantees only one
row is inserted. The repository recognises PostgreSQL's error code for a
unique violation and converts it:

```ts
if (error instanceof SQL.PostgresError && error.errno === "23505") {
  throw new EmailTakenError();   // the router turns this into 409 Conflict
}
```

`errno` holds PostgreSQL's five-character SQLSTATE code. (Last year's code
compared the error *message* with `"23505"`, so this case was never detected.)

Emails are also **normalised** (trimmed, lower-cased) before storing and
comparing, so `Ada@Example.com` and `ada@example.com` are one account.

### Logging in without leaking information

```ts
if (!user) throw new InvalidCredentialsError();
if (!(await Bun.password.verify(password, user.passwordHash))) throw new InvalidCredentialsError();
```

Both failures produce the same `401` and the same message. Different messages
("no such user" vs. "wrong password") would let anyone find out which email
addresses are registered. Week 11 demonstrates exactly that attack.

### JSON Web Tokens

After a successful login the API returns a token:

```
eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImFkYUBleGFtcGxlLmNvbSIsInN1YiI6IjNmMWMi…fQ.k8Pz2rQ…
└──── header ──────┘ └──────────────────── payload ───────────────────────┘ └ signature ┘
```

| Part | Content |
| ---- | ------- |
| header | `{"alg":"HS256"}` – the signing algorithm |
| payload | `{"email":"ada@example.com","sub":"<user id>","iat":…,"exp":…}` – the *claims* |
| signature | HMAC-SHA256 of header and payload, keyed with `JWT_SECRET` |

- The header and payload are only Base64URL-**encoded**. Anyone can read them
  (paste a token into <https://jwt.io>). Never put secrets in a token.
- Nobody can **change** them without the secret: the signature would no longer
  match. The tests prove that a token with an edited payload, a token signed
  with a different secret, and an expired token are all rejected.
- The server stores nothing about issued tokens; verifying the signature and
  `exp` is enough. That is *stateless* authentication. The flip side: a token
  cannot be revoked before it expires, so keep lifetimes short (here 2 hours).

Bun has no JWT functions built in, so we use [`jose`](https://github.com/panva/jose):

```ts
await new SignJWT({ email: user.email })
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(user.id)
  .setIssuedAt()
  .setExpirationTime("2h")
  .sign(secretKey);

const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
```

The client sends the token in the standard header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.…
```

and `requireAuth(req)` returns the user or `null`:

```ts
async function listNotesHandler(req: Request): Promise<Response> {
  const user = await requireAuth(req);
  if (!user) return fail("Not authenticated", 401);
  return ok(await listNotes());
}
```

Every protected handler must remember to make this call. Week 8 replaces it
with an Elysia macro, `{ auth: true }` on the route, so the check is part of
the route definition and cannot be forgotten.

### Secrets in configuration

`JWT_SECRET` must be long and random; whoever knows it can mint tokens for any
user. `config.ts` refuses to start if it is missing or shorter than 32
characters. Generate one with:

```bash
bun -e 'console.log(crypto.getRandomValues(new Uint8Array(32)).toBase64())'
```

CORS now also allows the `Authorization` header (`util/response.ts`), since
the client sends it cross-origin.

## Concepts: the front-end

### React Router

A single-page application still has "pages": different URLs that show
different screens. React Router maps URLs to components and changes the URL
without reloading the page:

```tsx
// main.tsx
<BrowserRouter>
  <App />
</BrowserRouter>

// App.tsx
<Routes>
  <Route path="/" element={<Navigate to="/notes" replace />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/notes" element={<ProtectedRoute><NotesPage /></ProtectedRoute>} />
  <Route path="*" element={<div className="card">Page not found.</div>} />
</Routes>
```

| Tool | Use |
| ---- | --- |
| `<Link to="/register">` | A link that navigates without a reload (a plain `<a href>` reloads the whole app) |
| `<Navigate to="…" replace />` | Redirect while rendering |
| `useNavigate()` | Navigate from code, e.g. after a successful login |
| `useLocation()` | The current URL and its navigation `state` |

Install it with `bun add react-router`. (Since version 7 the package is
`react-router`; `react-router-dom` is an older alias.)

Deep links such as <http://localhost:5173/notes> work in development because
Bun's dev server answers unknown paths with `index.html`; the router then
picks the page. Week 12 configures the same behaviour for the production host.

### Protected routes

```tsx
export default function ProtectedRoute({ children }) {
  const location = useLocation();
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
```

The original location travels in the **navigation state**, so after logging
in, `LoginPage` sends the user back to where they wanted to go. The register
page uses the same mechanism to pass a success message to the login page.

A protected route is a **convenience**, not a security measure: anyone can
change JavaScript running in their own browser. The data is protected because
the API answers `401` without a valid token.

### Keeping the token

`auth.ts` stores the token in `localStorage`, so the user stays logged in
across reloads. `api.ts` adds it to every request:

```ts
const token = getToken();
if (token) headers.set("Authorization", `Bearer ${token}`);
```

When the API answers `401` (the token expired, or was tampered with),
`NotesPage` clears the token and redirects to the login page with a message.

`localStorage` is readable by any script on the page, so an XSS vulnerability
would expose the token. Week 10 shows the alternative: an `HttpOnly` session
cookie that JavaScript cannot read.

### Re-rendering the navigation bar

The login state lives in `localStorage`, which React does not observe. `NavBar`
calls `useLocation()`, which makes it re-render on every navigation, so the
links switch from *Login/Register* to *Logout* right after logging in.
Week 8 replaces the trick with `useSyncExternalStore`, and week 12 with an
authentication **context**.

## Lecture walkthrough

**Back-end**

1. `sql/schema.sql`, `bun run db:setup`. Look at the `unique` constraint.
2. `.env` with `JWT_SECRET`, `config.ts`.
3. `user-repository.ts` with the unique-violation handling, `notes-repository.ts`.
4. `auth-service.ts`: `register` with `Bun.password.hash`; `login` with
   `verify`. Look at a hash in the database.
5. `auth-middleware.ts`: `signToken`, `requireAuth`. Decode a token on jwt.io.
6. `router.ts` and test with curl:

   ```bash
   curl -X POST http://localhost:8000/api/auth/register -H "content-type: application/json" \
     -d '{"email":"ada@example.com","password":"correct horse"}'

   TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "content-type: application/json" \
     -d '{"email":"ada@example.com","password":"correct horse"}' | bun -e 'console.log(JSON.parse(await Bun.stdin.text()).data.token)')

   curl -i http://localhost:8000/api/notes                                   # 401
   curl http://localhost:8000/api/notes -H "Authorization: Bearer $TOKEN"    # 200
   ```

**Front-end**

7. `bun add react-router`; `BrowserRouter` in `main.tsx`, `Routes` in `App.tsx`.
8. `auth.ts` and `api.ts` (token header, `ApiError` with status).
9. `RegisterPage`, `LoginPage` (navigation state), `NotesPage` (401 handling).
10. `ProtectedRoute`, `NavBar`.
11. Demonstrate: open `/notes` logged out; log in; edit the token in DevTools →
    Application → Local Storage and reload.

## Compared with last year's Deno version

| Deno | Bun |
| ---- | --- |
| `jsr:@felix/bcrypt` | `Bun.password` (built in, Argon2id by default) |
| `--allow-net --allow-env --allow-read --allow-write --allow-ffi --env-file=.env` | nothing: `.env` is loaded automatically |
| `react-router-dom` | `react-router` |

Fixed: registration validates its input (it crashed with `500` on a missing
field), the unique-violation check uses the real error code, a missing
`JWT_SECRET` stops the server, login returns the token inside the usual
`data` envelope, and unknown routes return JSON.

## Exercises

1. Add `GET /api/auth/me` that returns the `PublicUser` for the token. Use it
   in the client to show "Logged in as …" in the navigation bar.
2. Give each note an owner (`user_id`) and let users create their own notes
   (`POST /api/notes`). `GET /api/notes` should return only the caller's notes.
   Which SQL changes, and where does the user id come from? (Never from the
   request body.)
3. Log the user out automatically when the token expires: decode `exp` from the
   payload (`JSON.parse(atob(token.split(".")[1]))`) and set a timer.
4. The token is valid for 2 hours. What could you do if a user's account is
   deleted after they logged in? List options and their costs.

## Further reading

- [Bun: Hashing passwords](https://bun.sh/docs/runtime/hashing)
- [OWASP: Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [jwt.io: Introduction to JSON Web Tokens](https://jwt.io/introduction)
- [jose documentation](https://github.com/panva/jose)
- [React Router: Declarative mode](https://reactrouter.com/start/declarative/installation)
- [MDN: HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Authentication)
