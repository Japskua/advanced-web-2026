# Week 8 – Elysia, layered architecture, RBAC and shadcn/ui

The **Community Notice Board** has two kinds of users. Everyone who registers
can read the notifications; **administrators** can also publish notifications
and manage users. That is **role-based access control (RBAC)**.

This is also the week where the back-end structure that has grown since week 4
is completed: **routes → services → repositories → database**, with a clear
rule for what belongs in each layer, **DTOs** separated from **entities**, and
errors handled in one place.

And it is the week the API gets a **framework**. Since week 1 you have written
by hand what every web framework does: a route table, parsing and validating
JSON bodies (week 2), middleware that wraps handlers (week 5), CORS headers and
preflights, a central error handler. That was the point: now you know what a
framework does for you. From this week on the API uses **[Elysia](https://elysiajs.com)**,
a framework made for Bun. The service and repository layers do not change at
all; only the HTTP edge gets shorter.

The front-end switches from hand-written CSS to **shadcn/ui** components styled
with **Tailwind CSS**.

## Learning objectives

After this week you can:

- explain the responsibility of each layer and trace a request through all of them
- tell a DTO from an entity, and map one to the other deliberately
- build an API with Elysia: routes, plugins, lifecycle hooks, and what each replaces from plain `Bun.serve`
- implement RBAC with an Elysia macro (`{ auth: true }`, `{ role: "admin" }`) and use `401` vs `403` correctly
- throw typed application errors and convert them to responses in one central `onError` handler
- validate input with schemas (`t.Object(...)`) and sanitise it at the edge of the application, with messages a user can act on
- seed an initial administrator safely
- build a React UI with shadcn/ui and Tailwind CSS: theme, layout, forms, tables, dialogs
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
│       ├── main.ts                    app.listen(PORT)
│       ├── app.ts                     the Elysia app: cors, logger, errorHandler, routes
│       ├── routes.ts                  every endpoint, its access rule and its schemas, on one screen
│       ├── schemas.ts                 t.Object(...) schemas + sanitising and the password policy
│       ├── services/                  business rules: auth-, notification-, user-service
│       ├── repositories/              SQL: user-, notification-repository
│       ├── db/client.ts               the connection pool
│       ├── plugins/
│       │   ├── auth.ts                macros { auth: true } and { role: "admin" }
│       │   └── logger.ts              onRequest / onAfterResponse hooks
│       ├── types.ts                   entities (UserEntity, NotificationEntity) and AuthUser
│       ├── mappers.ts                 entity → DTO
│       ├── errors.ts                  AppError subclasses + the errorHandler plugin (onError)
│       ├── config.ts
│       └── util/                      jwt.ts, response.ts (the ok() envelope)
└── community-notice-board-client/src/
    ├── main.tsx                       BrowserRouter (no theme provider needed)
    ├── index.css                      Tailwind CSS + the theme (CSS variables)
    ├── App.tsx                        routes with ProtectedRoute / AdminRoute
    ├── auth.ts                        token store with change events
    ├── hooks/useAuth.ts               login state via useSyncExternalStore
    ├── api.ts                         request<T>(); clears the token on 401
    ├── components/                    AppLayout, ProtectedRoute, AdminRoute
    ├── components/ui/                 shadcn/ui components (copied in by `shadcn add`, yours to edit)
    └── pages/                         Login, Register, Notifications, AdminNewNotification, AdminUsers
```

---

## Concepts: the back-end

### From Bun.serve to Elysia

Elysia is a web framework built for Bun (it runs on `Bun.serve` underneath).
You build an app by chaining calls on one object:

```ts
import { Elysia, t } from "elysia";

new Elysia()
  .get("/api/hello", () => ({ ok: true, data: "hello" }))       // returning an object sends JSON
  .post("/api/echo", ({ body }) => body, {
    body: t.Object({ text: t.String() }),                          // validated before the handler runs
  })
  .listen(8000);
```

What it replaces from the earlier weeks:

| Written by hand until week 7 | Elysia, this week |
| ---------------------------- | ----------------- |
| `routes` table for `Bun.serve`, `fallback()` for 404 | `.get()`, `.post()`, … on the app; 404 is built in |
| `readJson()`, `asRecord()`, `typeof` checks (week 2 `validation.ts`) | a schema per route: `body: t.Object({...})`, `params: t.Object({...})` |
| `applyMiddleware()` + `withLogging` (week 5) | lifecycle hooks: `onRequest`, `onAfterResponse` (`plugins/logger.ts`) |
| `requireAuth(req)` called in every handler (week 7) | a **macro**: `{ auth: true }` on the route (`plugins/auth.ts`) |
| `corsHeaders()` on every response + the OPTIONS case | `.use(cors({...}))` from `@elysiajs/cors` |
| `Bun.serve({ error: errorHandler })` | `.onError(...)` (`errors.ts`) |
| `req.params.id` typed by `BunRequest<"/…/:id">` | `params.id` typed from the schema; `body` typed from its schema too |

A **plugin** is just another Elysia instance that the app `.use()`s: the
logger, the error handler, the auth macros and the routes are each a plugin,
and `app.ts` puts them together. `app` is exported without listening, so the
tests call it directly with `app.handle(new Request(...))`; only `main.ts`
calls `app.listen(PORT)`.

### The layers and their responsibilities

```
            ┌───────────────────────────────────────────────────────────────────┐
request ──▶ │ app.ts         plugins for every request: cors, logger            │
            │ routes.ts      path, schema (validated by Elysia), access rule    │
            │                (auth macro), one-line handler → call service      │
            │ services/      business rules; work with entities, return DTOs     │
            │ repositories/  SQL; return entities                                │
            │ db/client.ts   connection pool                                     │
            └───────────────────────────────────────────────────────────────────┘
                     errors thrown anywhere ──▶ errors.ts onError ──▶ response
```

| Layer | Knows about | Must not know about |
| ----- | ----------- | ------------------- |
| routes (+ schemas) | URLs, methods, access rules, input shapes, status codes | SQL, password hashing |
| services | business rules, entities, DTOs | HTTP, SQL |
| repositories | SQL, tables, entities | HTTP, business rules |

Until week 7 there was a separate *handler* layer that parsed and validated
the request. With Elysia the schemas do that, so each handler shrinks to one
line and lives next to its route in `routes.ts`.

Follow one request through the code: `DELETE /api/admin/users/:id`

1. `routes.ts`: `.delete("/admin/users/:id", handler, { role: "admin", params: userIdParams })`.
2. Elysia checks `:id` against the schema (`format: "uuid"`), else `400 Invalid user id.`
3. The `role` macro (`plugins/auth.ts`) verifies the token, loads the user,
   checks the role, and hands the handler a typed `user`.
4. The handler calls `userService.deleteUser`, which applies the rule "admins
   cannot delete themselves", then calls the repository.
5. `userRepository.deleteUserById` runs the SQL. The database deletes the
   user's notifications too (`on delete cascade`).
6. Back in the handler: `status(204)`. If any step threw, `onError` produced
   the response instead.

Why bother? Each piece can be read, tested and changed on its own. A new
client (a mobile app) reuses everything below the routes. Moving from
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

and one hook turns errors into responses (`errors.ts`):

```ts
export const errorHandler = new Elysia({ name: "error-handler" })
  .error({ AppError })
  .onError({ as: "global" }, ({ code, error, set }) => {
    if (error instanceof AppError) { set.status = error.status; return fail(error.message); }
    switch (code) {
      case "VALIDATION": set.status = 400; return fail(error.customError);  // a schema did not match
      case "PARSE":      set.status = 400; return fail("The request body must be valid JSON.");
      case "NOT_FOUND":  set.status = 404; return fail("Not found");
    }
    console.error("Unhandled error:", error);   // a bug or an outage: log everything, reveal nothing
    set.status = 500; return fail("Internal server error");
  });
```

Elysia raises its own errors too (`code` tells them apart), so the same
envelope `{ ok: false, error: { message } }` comes back whether a schema
failed or a service threw. `as: "global"` makes the hook apply to every route
of the app that uses the plugin. Compare the routes with week 7's handlers: no
`try/catch`, no status-code decisions. Week 7's `register` was 15 lines; now
it is two.

### RBAC with a macro

```ts
export const routes = new Elysia({ prefix: "/api" })
  .use(auth)
  .post("/auth/login", ({ body }) => …, { body: credentialsBody })               // public
  .get("/notifications", async () => ok(await listNotifications()), { auth: true })  // any user
  .post("/admin/notifications", ({ body, user }) => …, { role: "admin", body: createNotificationBody })
  .delete("/admin/users/:id", ({ params, user }) => …, { role: "admin", params: userIdParams });
```

A macro adds an option to the route definition (`plugins/auth.ts`):

```ts
export const auth = new Elysia({ name: "auth" }).macro({
  auth: { async resolve({ headers }) { return { user: await authenticate(headers.authorization) }; } },
  role: (role: Role) => ({
    async resolve({ headers }) {
      const user = await authenticate(headers.authorization);
      if (user.role !== role) throw new ForbiddenError(`This requires the ${role} role`);
      return { user };
    },
  }),
});
```

- `resolve` runs before the handler. What it returns (`{ user }`) is added to
  the handler's context, **typed**: in a route with `auth` or `role`, `user`
  is an `AuthUser`. In a route without them `user` does not exist, so
  TypeScript stops a handler that forgot its access rule from using it.
- It replaces week 7's `requireAuth(req)` call in every handler: the rule is
  declared as data on the route, so no handler can forget it.
- `401` = no valid identity. `403` = valid identity, not allowed.
- The access rules are readable in one file. Security reviews love that.
- Order of the lifecycle: Elysia **parses and validates** the body and params
  *before* `resolve` runs. A request with no token *and* a malformed id gets
  `400`, not `401`. (Is that a problem? Discuss.)

**Fresh user data on every request.** The token says who the user was when
they logged in. `authenticate()` looks the user up again, so a deleted user (or
a demoted admin) loses access **immediately**, not when the token expires an
hour later. The price is one indexed query per request. A test covers it:
delete a user, and their still-valid token gets `401 Account no longer exists`.

**Where the role comes from.** Registration through the API always creates a
`user`; a `role` field in the body is ignored (Elysia drops properties the
schema does not list). The first admin is created from the command line
(`bun run seed:admin`), by someone who can read the server's `.env`. The
database enforces the possible values with `check (role in ('user', 'admin'))`.

### Validation and sanitisation

`schemas.ts` declares the **shape** of each input, and Elysia checks it before
the handler runs:

```ts
const REQUIRED = "Email and password are required.";
export const credentialsBody = t.Object(
  { email: t.String({ error: REQUIRED }), password: t.String({ minLength: 1, error: REQUIRED }) },
  { error: REQUIRED },
);
export const userIdParams = t.Object({ id: t.String({ format: "uuid", error: "Invalid user id." }) });
```

The `error` option is the message the client sees. Put it on the object
**and** on each field, so every way the input can be wrong (missing field,
wrong type, not an object at all) gets the same message.

What a schema cannot express stays code, in the same file:

- **sanitise**: trim titles and contents, lower-case emails (`cleanCredentials`, `cleanNotification`);
- **validate** rules whose message depends on the value: the email format and
  the password policy, which lists exactly what is missing ("an uppercase
  letter, a number") (`cleanRegistration`).

The password policy applies to **registration only**. Applying it at login
would tell attackers the policy and lock out users whose passwords predate it.
(Last year's version did that.)

> **Gotcha.** For a field with a fixed set of values use
> `t.Union([t.Literal("user"), t.Literal("admin")])`. `t.UnionEnum([...])` looks
> the same but quietly fills in its first value when the field is missing, so
> `{}` would pass as `{ role: "user" }`.

## Concepts: the front-end

### shadcn/ui and Tailwind CSS

[shadcn/ui](https://ui.shadcn.com/) is a set of ready-made React components:
buttons, inputs, cards, tables, dialogs. Unlike most component libraries it is
**not a package you install**: the `shadcn` command copies each component's
source code into `src/components/ui/`, and from then on it is your code. Open
`button.tsx` and you can see exactly how the button is built, and change it.

The components are built on [Radix UI](https://www.radix-ui.com/) primitives,
which handle the hard parts of accessibility (keyboard use, focus, ARIA roles),
and are styled with **[Tailwind CSS](https://tailwindcss.com/)**. Tailwind
styles an element with small utility classes in `className` instead of a
separate stylesheet:

```tsx
<Card className="mx-auto max-w-md">          {/* centred, at most 28rem wide */}
  <form onSubmit={handleSubmit} className="grid gap-4">
    <div className="grid gap-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" required />
    </div>
    <Button type="submit">Login</Button>
  </form>
</Card>
```

`p-4` is a padding of 1rem (16px), `gap-2` puts 0.5rem between grid or flex
items, `mx-auto` centres horizontally, and `text-muted-foreground` uses a colour
from the theme. Only the classes the app uses end up in the CSS bundle.

**Setting it up.** Bun has its own template for this (`bun init --react=shadcn`);
the week 8 client uses the same pieces:

```bash
bun add radix-ui class-variance-authority cn lucide-react
bun add -d tailwindcss bun-plugin-tailwind tw-animate-css
bunx shadcn@latest add button card input label textarea alert alert-dialog badge table spinner
```

- `src/index.css` starts with `@import "tailwindcss"` and holds the **theme**:
  CSS variables such as `--primary` that every component reads. Changing
  `--primary` recolours every primary button and the header. `index.html` loads
  the file with a `<link>`.
- `bunfig.toml` gives Bun's dev server (`bun ./index.html`) the Tailwind plugin:
  `[serve.static] plugins = ["bun-plugin-tailwind"]`. `bun build` on the
  command line cannot load plugins, so `bun run build` runs `build.ts`, which
  calls `Bun.build()` with the plugin.
- `components.json` tells the `shadcn` command where components go, and
  `tsconfig.json` maps `@/*` to `src/*`, so the components import each other as
  `@/components/ui/button`.

Things to point out in the pages:

- Components are configured with props: `<Button variant="destructive" size="sm">`.
- `asChild` makes a `Button` render its child instead, here a React Router
  `<Link>`: the button's look with client-side navigation.
- A `className` you pass is merged with the component's own classes (the `cn()`
  helper), and yours wins. `AppLayout` uses that for the header buttons' hover colour.
- `Label` + `Input` are tied together with `htmlFor`/`id`, so a click on the
  label focuses the field and screen readers announce it.
- `Table` for the user list; `Alert` for messages (it has `role="alert"`, so
  screen readers read it out).
- `AlertDialog` for the delete confirmation: it has `role="alertdialog"`, keeps
  the focus inside while open, and Escape cancels. Its action button closes the
  dialog by itself, so `AdminUsersPage` calls `e.preventDefault()` to keep it
  open until the API has answered.

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
the API's `role` macro, which answers `403` regardless of what the browser shows.

## Lecture walkthrough

**Back-end** (build bottom-up, test each layer with curl):

1. Schema: roles with a check constraint, the foreign key with cascade.
2. `types.ts` (entities) vs `shared/types.ts` (DTOs); `mappers.ts`.
3. Repositories, including the `join` and the reusable column fragment.
4. `errors.ts`: the `AppError` family and the `errorHandler` plugin (`onError`).
5. Services: rules such as "no self-deletion".
6. Elysia: `bun add elysia @elysiajs/cors`; a hello-world app; compare with
   week 7's `Bun.serve` routes table. `app.ts` with `cors()` and `plugins/logger.ts`.
7. `schemas.ts`: `t.Object` schemas with `error` messages, plus the sanitising
   functions. Show a validation failure with curl.
8. `util/jwt.ts`, then `plugins/auth.ts`: the `auth` and `role` macros and the
   typed `user`. Then `routes.ts`: point out how short the handlers are.
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

10. Tailwind and shadcn/ui: `bun add …`, `bunx shadcn@latest add …`, the theme in
    `src/index.css`, `bunfig.toml` and `build.ts`.
11. `auth.ts` with events, `useAuth`, `api.ts` with the 401 rule.
12. `AppLayout`, `ProtectedRoute`, `AdminRoute`, `App.tsx`.
13. The pages. Demonstrate: a normal user opening `/admin/users`; deleting a
    logged-in user: their tab returns to the login page on its next request
    (reload it, or navigate).

## Compared with last year's Deno version

- The API uses Elysia (weeks 1–7 use plain `Bun.serve`): schemas instead of
  hand-written validation, macros instead of middleware wrappers, plugins for
  CORS and logging; the special case for `DELETE /api/admin/users/:id` outside
  the route map is gone.
- `Bun.password` replaces bcrypt; no permission flags.
- New: `AppError` classes with a central handler; entity/DTO split with
  mappers; `GET /api/auth/me`; fresh user lookup on every request; validation
  messages listing the password rules; user list with a confirmation dialog;
  shadcn/ui and Tailwind CSS instead of Material UI.
- Fixed: no `"dev-secret"` fallback for `JWT_SECRET`; login no longer applies
  the password policy; malformed ids give `400`.

## Exercises

1. Add `PATCH /api/admin/users/:id/role` with `{ "role": "admin" | "user" }`.
   Which layer checks that the last admin cannot be demoted? Add a button in
   the users table.
2. Add `DELETE /api/admin/notifications/:id` (admins) and a delete button on
   each notification card that only admins see.
3. Add a third role, `moderator`, who can publish notifications but not manage
   users. What changes in the `role` macro? Would a list of allowed roles be better?
4. Write unit tests for `passwordPolicyViolations()` and for the mappers. Why
   are these easier to test than routes?

## Further reading

- [Elysia: Key concepts](https://elysiajs.com/key-concept.html)
- [Elysia: Validation](https://elysiajs.com/essential/validation.html), [Lifecycle](https://elysiajs.com/essential/life-cycle.html), [Macro](https://elysiajs.com/patterns/macro.html)
- [Martin Fowler: Presentation Domain Data Layering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html)
- [Martin Fowler: Data Transfer Object](https://martinfowler.com/eaaCatalog/dataTransferObject.html)
- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [shadcn/ui: Components](https://ui.shadcn.com/docs/components)
- [Tailwind CSS: Styling with utility classes](https://tailwindcss.com/docs/styling-with-utility-classes)
- [Bun: Full-stack dev server and bundler (includes Tailwind CSS)](https://bun.sh/docs/bundler/fullstack)
- [react.dev: useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
