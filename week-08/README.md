# Week 8 – Layered architecture, RBAC and Material UI

The **Community Notice Board** has two kinds of users. Everyone who registers
can read the notifications; **administrators** can also publish notifications
and manage users. That is **role-based access control (RBAC)**.

This is also the week where the back-end structure that has grown since week 4
is completed: **routes → handlers → services → repositories → database**, with
a clear rule for what belongs in each layer, **DTOs** separated from
**entities**, and errors handled in one place. The front-end switches from
hand-written CSS to the **Material UI** component library.

## Learning objectives

After this week you can:

- explain the responsibility of each layer and trace a request through all of them
- tell a DTO from an entity, and map one to the other deliberately
- implement RBAC with composable middleware (`withAuth`, `withAdmin`) and use `401` vs `403` correctly
- throw typed application errors and convert them to responses in one central handler
- validate and sanitise input at the edge of the application, with messages a user can act on
- seed an initial administrator safely
- build a React UI with Material UI: theme, layout, forms, tables, dialogs
- subscribe React components to state that lives outside React (`useSyncExternalStore`)

## What you build

| Method | Path | Access | Success | Errors |
| ------ | ---- | ------ | ------- | ------ |
| `POST` | `/api/auth/register` | public | `201` `UserDto` | `400` policy, `409` taken |
| `POST` | `/api/auth/login` | public | `200` `{ token, user }` | `400`, `401` |
| `GET` | `/api/auth/me` | user | `200` `UserDto` | `401` |
| `GET` | `/api/notifications` | user | `200` `NotificationDto[]` | `401` |
| `POST` | `/api/admin/notifications` | admin | `201` `NotificationDto` | `400`, `401`, `403` |
| `GET` | `/api/admin/users` | admin | `200` `UserDto[]` | `401`, `403` |
| `DELETE` | `/api/admin/users/:id` | admin | `204` | `400` own account / bad id, `401`, `403`, `404` |

Client pages: `/login`, `/register`, `/notifications` (users), and
`/admin/notifications/new`, `/admin/users` (admins).

## Running it

```bash
# repository root, once
docker compose up -d

# terminal 1
cd week-08/community-notice-board-api
cp .env.example .env          # set JWT_SECRET; ADMIN_EMAIL / ADMIN_PASSWORD are the first admin
bun run db:setup
bun run seed:admin            # creates the admin from .env (safe to run again)
bun run dev                   # http://localhost:8000
bun test                      # 15 tests

# terminal 2
cd week-08/community-notice-board-client
bun run dev                   # http://localhost:5173
```

Log in as the admin from `.env`, publish a notification, then register an
ordinary user in another browser (or a private window) and compare.

## Project structure

```
week-08/
├── shared/types.ts                    DTOs: UserDto, NotificationDto, request bodies, TokenClaims, ApiResult
├── community-notice-board-api/
│   ├── sql/schema.sql                 users (role + check constraint), notifications (foreign key, cascade)
│   ├── scripts/
│   │   ├── db-setup.ts
│   │   └── seed-admin.ts              bun run seed:admin
│   └── src/
│       ├── main.ts                    Bun.serve: routes + logging + central error handler
│       ├── routes.ts                  every endpoint and its access rule, on one screen
│       ├── handlers/                  HTTP layer: auth-, notification-, user-handlers
│       ├── services/                  business rules: auth-, notification-, user-service
│       ├── repositories/              SQL: user-, notification-repository
│       ├── db/client.ts               the connection pool
│       ├── middleware/
│       │   ├── auth.ts                withAuth, withRole, withAdmin
│       │   ├── logger.ts, middleware.ts
│       ├── types.ts                   entities (UserEntity, NotificationEntity) and AuthUser
│       ├── mappers.ts                 entity → DTO
│       ├── errors.ts                  AppError subclasses + errorHandler
│       ├── config.ts
│       └── util/                      jwt.ts, response.ts, validation.ts
└── community-notice-board-client/src/
    ├── main.tsx                       ThemeProvider, CssBaseline, BrowserRouter
    ├── theme.ts                       MUI theme
    ├── App.tsx                        routes with ProtectedRoute / AdminRoute
    ├── auth.ts                        token store with change events
    ├── hooks/useAuth.ts               login state via useSyncExternalStore
    ├── api.ts                         request<T>(); clears the token on 401
    ├── components/                    AppLayout, ProtectedRoute, AdminRoute
    └── pages/                         Login, Register, Notifications, AdminNewNotification, AdminUsers
```

---

## Concepts: the back-end

### The layers and their responsibilities

```
            ┌───────────────────────────────────────────────────────────────────┐
request ──▶ │ routes.ts      which handler, which access rule                    │
            │   middleware   withLogging (all), withAuth / withAdmin (per route) │
            │ handlers/      HTTP: parse + validate input → call service → JSON  │
            │ services/      business rules; work with entities, return DTOs     │
            │ repositories/  SQL; return entities                                │
            │ db/client.ts   connection pool                                     │
            └───────────────────────────────────────────────────────────────────┘
                     errors thrown anywhere ──▶ errors.ts errorHandler ──▶ response
```

| Layer | Knows about | Must not know about |
| ----- | ----------- | ------------------- |
| routes | URLs, methods, access rules | how anything is done |
| handlers | `Request`, `Response`, status codes, validation | SQL, password hashing |
| services | business rules, entities, DTOs | HTTP, SQL |
| repositories | SQL, tables, entities | HTTP, business rules |

Follow one request through the code: `DELETE /api/admin/users/:id`

1. `routes.ts`: `withAdmin(userHandlers.remove)`.
2. `withAdmin` → `withAuth` verifies the token, loads the user, checks the role.
3. `userHandlers.remove` validates the id (`parseUuid`) and calls the service.
4. `userService.deleteUser` applies the rule "admins cannot delete
   themselves", then calls the repository.
5. `userRepository.deleteUserById` runs the SQL. The database deletes the
   user's notifications too (`on delete cascade`).
6. Back in the handler: `204 No Content`. If any step threw, the
   `errorHandler` produced the response instead.

Why bother? Each piece can be read, tested and changed on its own. A new
client (a mobile app) reuses everything below the handlers. Moving from
PostgreSQL to something else touches the repositories only. The rule "admins
cannot delete themselves" exists in exactly one place.

### Entities and DTOs

| | Entity (`src/types.ts`) | DTO (`shared/types.ts`) |
| - | ----------------------- | ----------------------- |
| Describes | a database row | data sent over the network |
| Shaped by | the table | what the client needs |
| Example | `UserEntity { id, email, passwordHash, role, createdAt: Date }` | `UserDto { id, email, role, createdAt: string }` |
| Leaves the API? | never | always |

`mappers.ts` is the only bridge:

```ts
export function toUserDto(user: UserEntity): UserDto {
  return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt.toISOString() };
}
```

`passwordHash` cannot leak, because nothing maps it. If someone adds a column
to `users`, it stays internal until it is deliberately added to the DTO and the
mapper. Returning database rows directly (as week 7's notes repository did)
gives no such guarantee.

DTOs can also be *richer* than one row: `NotificationDto` includes the
author's email, which the repository gets with a `join`.

### Errors as values that carry a status

```ts
export class AppError extends Error {
  constructor(readonly status: number, message: string) { … }
}
export class NotFoundError extends AppError { constructor(message = "Not found") { super(404, message); } }
// BadRequestError 400, UnauthorizedError 401, ForbiddenError 403, ConflictError 409
```

Any layer throws:

```ts
if (!deleted) throw new NotFoundError("User not found");
```

and one function turns errors into responses:

```ts
export function errorHandler(error: Error): Response {
  if (error instanceof AppError) return fail(error.message, error.status);
  console.error("Unhandled error:", error);
  return fail("Internal server error", 500);
}

Bun.serve({ routes, fetch: fallback, error: errorHandler });
```

Compare the handlers with week 7's: no `try/catch`, no status-code
decisions. Week 7's `register` was 15 lines; now it is two.

### RBAC with composable middleware

```ts
export const routes = {
  "/api/auth/login":          { POST: authHandlers.login },                        // public
  "/api/notifications":       { GET: withAuth(notificationHandlers.list) },        // any user
  "/api/admin/notifications": { POST: withAdmin(notificationHandlers.create) },    // admins
  "/api/admin/users/:id":     { DELETE: withAdmin(userHandlers.remove) },
};
```

- `withAuth(handler)` returns a handler that checks the token first and passes
  the authenticated user to the wrapped handler as a second argument. A
  protected handler *cannot* run without a user.
- `withRole(role, handler)` builds on `withAuth` and adds the role check;
  `withAdmin` is shorthand. Middleware composes: each one is a function from
  handler to handler.
- `401` = no valid identity. `403` = valid identity, not allowed.
- The access rules are readable in one file. Security reviews love that.

**Fresh user data on every request.** The token says who the user was when
they logged in. `withAuth` looks the user up again, so a deleted user (or a
demoted admin) loses access **immediately**, not when the token expires an hour
later. The price is one indexed query per request. A test covers it: delete a
user, and their still-valid token gets `401 Account no longer exists`.

**Where the role comes from.** Registration through the API always creates a
`user`; a `role` field in the body is ignored. The first admin is created from
the command line (`bun run seed:admin`), by someone who can read the server's
`.env`. The database enforces the possible values with
`check (role in ('user', 'admin'))`.

### Validation and sanitisation

`util/validation.ts` turns `unknown` input into typed, clean values, or throws a
`BadRequestError`:

- **sanitise**: trim titles and contents, lower-case emails;
- **validate**: required fields, types, maximum lengths, UUID format, password
  policy;
- **explain**: the password message lists exactly what is missing ("an
  uppercase letter, a number").

The password policy applies to **registration only**. Applying it at login
would tell attackers the policy and lock out users whose passwords predate it.
(Last year's version did that.)

## Concepts: the front-end

### Material UI

[Material UI (MUI)](https://mui.com/material-ui/) is a library of ready-made
React components: buttons, text fields, tables, dialogs, layout. Install it
with its styling engine:

```bash
bun add @mui/material @emotion/react @emotion/styled
```

```tsx
<ThemeProvider theme={theme}>     {/* colours, typography, shape for every component */}
  <CssBaseline />                 {/* a CSS reset */}
  <App />
</ThemeProvider>
```

Components are configured with props and styled with **`sx`**, which accepts
CSS plus theme shortcuts:

```tsx
<Paper sx={{ p: 4, maxWidth: 480, mx: "auto" }}>      {/* padding 32px, centred */}
  <Box component="form" onSubmit={handleSubmit} sx={{ display: "grid", gap: 2 }}>
    <TextField label="Email" type="email" required fullWidth />
    <Button type="submit" variant="contained">Login</Button>
  </Box>
</Paper>
```

Other things to point out in the pages: `component={RouterLink}` makes an MUI
`Button` or `Link` navigate with React Router; `Table` for the user list;
`Dialog` for the delete confirmation; `Alert` for messages.

> **MUI 9 note.** Layout props such as `justifyContent` are no longer accepted
> directly on `Stack`/`Box`; put them in `sx`:
> `<Stack direction="row" sx={{ justifyContent: "center" }}>`. Many tutorials
> online still show the old style.

### Login state that React can observe

Week 7 had a problem: the token lives in `localStorage`, which React does not
watch, so the nav bar only updated thanks to a `useLocation()` trick. This week
the token store announces changes (`auth.ts` dispatches an event), and a hook
subscribes to it:

```ts
export function useAuth(): AuthState {
  const token = useSyncExternalStore(subscribeToAuth, getToken);
  return useMemo(() => { const claims = token ? decodeClaims(token) : null; … }, [token]);
}
```

`useSyncExternalStore(subscribe, getSnapshot)` is React's hook for state that
lives outside React. Every component using `useAuth()` re-renders when the
token changes, including in **other tabs** (the browser's `storage` event).

That enables central 401 handling. In `api.ts`:

```ts
if (res.status === 401 && token) clearToken();
```

Clearing the token re-renders `ProtectedRoute`, which redirects to `/login`.
No page needs its own 401 code.

### Role-aware UI, and its limits

`decodeClaims()` reads the role from the token so the UI can show admin links
and guard admin pages (`AdminRoute`). The client cannot verify the signature,
and a user can edit their own token, so this is presentation only. Security is
the API's `withAdmin`, which answers `403` regardless of what the browser shows.

## Lecture walkthrough

**Back-end** (build bottom-up, test each layer with curl):

1. Schema: roles with a check constraint, the foreign key with cascade.
2. `types.ts` (entities) vs `shared/types.ts` (DTOs); `mappers.ts`.
3. Repositories, including the `join` and the reusable column fragment.
4. `errors.ts`: the `AppError` family and `errorHandler`.
5. `validation.ts`: parsers that throw `BadRequestError`.
6. Services: rules such as "no self-deletion".
7. `util/jwt.ts`, then `middleware/auth.ts`: `withAuth`, `withRole`, `withAdmin`.
8. Handlers and `routes.ts`. Point out how short the handlers are.
9. `seed-admin.ts`. Then try the endpoints:

   ```bash
   ADMIN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "content-type: application/json" \
     -d '{"email":"admin@example.com","password":"Admin123!"}' | bun -e 'console.log(JSON.parse(await Bun.stdin.text()).data.token)')

   curl -X POST http://localhost:8000/api/admin/notifications -H "Authorization: Bearer $ADMIN" \
     -H "content-type: application/json" -d '{"title":"Hello","content":"First notice"}'
   curl http://localhost:8000/api/admin/users -H "Authorization: Bearer $ADMIN"
   ```

   Then register a normal user, use their token on the admin routes (`403`).

**Front-end**

10. `bun add @mui/material @emotion/react @emotion/styled`; theme and providers.
11. `auth.ts` with events, `useAuth`, `api.ts` with the 401 rule.
12. `AppLayout`, `ProtectedRoute`, `AdminRoute`, `App.tsx`.
13. The pages. Demonstrate: a normal user opening `/admin/users`; deleting a
    logged-in user: their tab returns to the login page on its next request
    (reload it, or navigate).

## Compared with last year's Deno version

- Routes use Bun's route table with typed parameters; the special case for
  `DELETE /api/admin/users/:id` outside the route map is gone.
- `Bun.password` replaces bcrypt; no permission flags.
- New: `AppError` classes with a central handler; entity/DTO split with
  mappers; `GET /api/auth/me`; fresh user lookup in `withAuth`; validation
  messages listing the password rules; user list with a confirmation dialog.
- Fixed: no `"dev-secret"` fallback for `JWT_SECRET`; login no longer applies
  the password policy; malformed ids give `400`; MUI updated to version 9.

## Exercises

1. Add `PATCH /api/admin/users/:id/role` with `{ "role": "admin" | "user" }`.
   Which layer checks that the last admin cannot be demoted? Add a button in
   the users table.
2. Add `DELETE /api/admin/notifications/:id` (admins) and a delete button on
   each notification card that only admins see.
3. Add a third role, `moderator`, who can publish notifications but not manage
   users. What changes in `withRole`? Would a list of allowed roles be better?
4. Write unit tests for `passwordPolicyViolations()` and for the mappers. Why
   are these easier to test than handlers?

## Further reading

- [Bun: Error handling in Bun.serve](https://bun.sh/docs/runtime/http/error-handling)
- [Martin Fowler: Presentation Domain Data Layering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html)
- [Martin Fowler: Data Transfer Object](https://martinfowler.com/eaaCatalog/dataTransferObject.html)
- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [Material UI: Getting started](https://mui.com/material-ui/getting-started/)
- [react.dev: useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
