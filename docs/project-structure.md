# How the back-end structure grows, week by week

The APIs in this course are deliberately small at first and gain structure only
when a new requirement makes the old structure hurt. Seeing the progression is
part of the lesson: architecture is a response to problems, not a template to
copy on day one.

## Week 1 – one file, one function

```
src/
├── main.ts       handler(req) with if-statements; Bun.serve({ fetch: handler })
├── task.ts       types
└── response.ts   jsonResponse()
```

Routing is `if (req.method === "GET" && url.pathname === "/tasks")`. Fine for
one endpoint.

## Week 2 – a route table, validation in its own module

```
src/
├── main.ts         Bun.serve({ routes, fetch: fallback })
├── router.ts       data, response helpers, handlers, route table, fallback
├── validation.ts   parse untrusted input → typed value or null
├── static.ts       files from public/
└── types.ts        Task, request bodies, ApiResult<T>
```

**Why:** five endpoints with path parameters make `if` chains unreadable;
Bun's `routes` table maps paths and methods to handlers. Validation is a
separate concern with its own tests.

## Week 4 – a service and a store; a shared contract

```
shared/types.ts                   ← both API and client import it
api/src/
├── router.ts                     HTTP only
├── services/external-joke-service.ts
└── store/saved-jokes-store.ts    "the database" behind a tiny interface
```

**Why:** calling another API (timeouts, mapping its format) does not belong in
a handler. The client and the API disagreed about field names, so the
contract became one shared file.

## Week 5 – middleware and utilities

```
src/
├── config.ts                     paths and limits in one place
├── middleware/
│   ├── middleware.ts             Handler/Middleware types, applyMiddleware(routes, …)
│   └── logger.ts                 withLogging
├── services/upload-service.ts    file system + JSON "database"
└── util/response.ts              ok(), fail(), CORS headers
```

**Why:** logging every request is a cross-cutting concern: wrap handlers
instead of editing each one. Response helpers are needed by several modules.

## Week 6 – a repository layer and a database

```
src/
├── config.ts                     now from .env, fails fast
├── db/client.ts                  the SQL connection pool
├── repositories/upload-repository.ts   the only code that writes SQL; row → object mapping
├── services/upload-service.ts    rules; calls the repository
└── router.ts                     + an `error` handler for the unexpected
```

**Why:** the JSON file could not handle concurrent writes. Putting SQL in one
layer means the rest of the code does not know a database exists.

## Week 7 – authentication

```
src/
├── middleware/auth-middleware.ts signToken(), requireAuth(req)
├── services/auth-service.ts      hashing, login rules
└── repositories/user-repository.ts, notes-repository.ts
```

**Why:** identity. `requireAuth` is still a call each handler must remember,
which motivates week 8.

## Week 8 – the complete layered architecture

```
shared/types.ts                   DTOs (what crosses the network)
api/src/
├── main.ts                       Bun.serve: routes + logging + errorHandler
├── routes.ts                     every endpoint + its access rule (withAuth / withAdmin)
├── handlers/                     HTTP: parse → service → response; throw on error
├── services/                     business rules; entities in, DTOs out
├── repositories/                 SQL; entities
├── middleware/                   auth.ts (withAuth, withRole, withAdmin), logger, middleware
├── types.ts                      entities (database rows), AuthUser
├── mappers.ts                    entity → DTO
├── errors.ts                     AppError subclasses + the central errorHandler
└── util/                         jwt, response, validation
```

**Why:** roles multiply the access rules; they must be visible in one place
(`routes.ts`) and impossible to forget (wrappers). Errors thrown from any layer
are turned into responses centrally, so handlers are a few lines long. DTOs and
entities separate what the database stores from what the client may see.

```
request → withLogging → withAuth/withAdmin → handler → service → repository → PostgreSQL
                                   errors from any layer ──→ errorHandler → JSON response
```

## Weeks 10–12 – the same shape, new concerns

- **Week 10** adds an `oidc/` module (provider discovery), a `login-service`
  for the OAuth flow and a `session-service`; cookies via `req.cookies`.
- **Week 11** keeps `vulnerable/` and `secure/` side by side to compare them.
- **Week 12** is week 8's structure plus `services/blob-storage.ts` (object
  storage), `util/rate-limiter.ts` (from week 11), a health route, graceful
  shutdown, and a Dockerfile.

## The front-end side

| Week | Structure |
| ---- | --------- |
| 3 | `App.tsx` with the state, `components/` for presentation |
| 4–6 | `api.ts` (one `request<T>()` helper), `config.ts`, `components/` |
| 7 | + `pages/`, `auth.ts`, React Router, route guard components |
| 8 | + MUI `theme.ts`, `hooks/useAuth.ts` (an external store) |
| 9 | + `hooks/` with custom hooks for data, debouncing, persistence |
| 10 | + `i18n/`, a layout route that loads the session once |
| 12 | + React contexts and providers (`auth/`, `encryption/`), `crypto.ts` |

## Rules of thumb collected from the course

- A handler reads the request and writes the response; nothing else.
- A service never sees `Request`, `Response` or SQL.
- A repository never builds responses; it turns the database errors it expects
  (such as a unique violation) into application errors (`ConflictError`).
- Only the repositories import the database client.
- Only the mappers know both the entity and the DTO.
- Every protected route is wrapped where it is declared.
- Every value from outside is `unknown` until a parser has checked it.
- Configuration comes from the environment and is validated at startup.
