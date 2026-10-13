# Week 6 – SQL database

Week 5 stored image metadata in a JSON file and ended with a list of reasons
why that does not scale. This week the **Image Gallery v2** moves the metadata
into **PostgreSQL**. The image files stay on disk (week 12 moves them to cloud
storage). Users can now also delete images.

The new back-end topics: connecting to a database with Bun's built-in SQL
client, **parameterised queries**, **mapping database rows** to application
objects, the **repository layer**, and configuration through **environment
variables**.

## Learning objectives

After this week you can:

- run PostgreSQL locally with Docker and create a schema from an SQL file
- connect to PostgreSQL with Bun's built-in `SQL` client and a connection pool
- write parameterised queries with tagged templates and explain why they prevent SQL injection
- map database rows (snake_case, `Date`) to API objects (camelCase, ISO strings)
- structure a back-end as router → service → repository → database
- keep configuration and secrets in `.env`, outside the code
- validate ids before they reach the database, and handle unexpected errors centrally

## What you build

The week 5 API plus one endpoint:

| Method | Path | Success | Errors |
| ------ | ---- | ------- | ------ |
| `GET` | `/api/uploads` | `200` `UploadRecord[]`, newest first | – |
| `POST` | `/api/uploads` | `201` the `UploadRecord` | `400`, `413`, `415` |
| `DELETE` | `/api/uploads/:id` | `200` the deleted `UploadRecord` | `400` malformed id, `404` unknown |
| `GET` | `/uploads/:filename` | `200` the image | `400`, `404` |

## Running it

PostgreSQL runs in Docker. From the **repository root**, once:

```bash
docker compose up -d          # starts PostgreSQL (and SeaweedFS, used in week 12)
```

The container creates one database per week; this week uses `image_gallery`.
Then:

```bash
# terminal 1
cd week-06/image-gallery-v2-api
cp .env.example .env          # once
bun run db:setup              # once: creates the uploads table
bun run dev                   # http://localhost:8000
bun test                      # 7 integration tests against the database

# terminal 2
cd week-06/image-gallery-v2-client
bun run dev                   # http://localhost:5173
```

To look inside the database, use any PostgreSQL client with the connection
details from `.env` (pgAdmin, DBeaver, the VS Code *PostgreSQL* extension), or
the `psql` inside the container:

```bash
docker exec -it awa-postgres psql -U postgres -d image_gallery
image_gallery=# select original_name, size, uploaded_at from uploads;
```

## Project structure

```
week-06/image-gallery-v2-api/
├── .env.example                   DATABASE_URL template (copy to .env)
├── sql/
│   └── schema.sql                 create table uploads …
├── scripts/
│   └── db-setup.ts                bun run db:setup → applies schema.sql
├── src/
│   ├── main.ts                    Bun.serve with middleware and an error handler
│   ├── config.ts                  reads and checks environment variables
│   ├── router.ts                  HTTP only: parse, call the service, choose the status
│   ├── db/
│   │   └── client.ts              the SQL connection pool
│   ├── repositories/
│   │   └── upload-repository.ts   SQL queries + row → UploadRecord mapping
│   ├── services/
│   │   └── upload-service.ts      rules: validation, files on disk, delete order
│   ├── middleware/                withLogging, applyMiddleware (from week 5)
│   └── util/
│       ├── response.ts            ok(), fail(), corsHeaders() (+ DELETE)
│       └── validation.ts          isUuid()
└── tests/uploads.test.ts
```

The client is week 5's plus a delete button (`Gallery.tsx`, `App.tsx`,
`api.ts`).

---

## Concepts

### PostgreSQL in Docker

The repository's `docker-compose.yml` runs PostgreSQL 18 in a container, with
the data in a Docker volume so it survives restarts. `docker/postgres-init.sql`
runs the first time the container starts and creates a database for each week.

| Command (repository root) | Effect |
| ------------------------- | ------ |
| `docker compose up -d` | start (in the background) |
| `docker compose ps` | status |
| `docker compose down` | stop, keep the data |
| `docker compose down -v` | stop and **delete** all data |

### The schema

```sql
create table if not exists uploads (
    id            uuid        primary key,
    filename      text        not null unique,
    original_name text        not null,
    mime_type     text        not null,
    size          integer     not null check (size > 0),
    uploaded_at   timestamptz not null default now()
);
create index if not exists uploads_uploaded_at_idx on uploads (uploaded_at desc);
```

- Constraints (`primary key`, `unique`, `not null`, `check`) are a second line
  of defence. Even if application code has a bug, the database refuses
  impossible data.
- `timestamptz` stores an absolute moment; `default now()` lets the database
  decide the upload time.
- The SQL lives in its own file outside `src/`. It is not application code, it
  describes the database. `scripts/db-setup.ts` applies it with
  `sql.file("sql/schema.sql")`.

In bigger projects, schema changes are managed with *migration* tools (each
change is a numbered file applied in order) and often an ORM or query builder
(Drizzle, Prisma, Kysely). They are useful, but they hide exactly the things
this week is about, so we write SQL by hand.

### Environment variables and `.env`

```bash
# .env (git-ignored)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/image_gallery
```

**Bun loads `.env` automatically** when a program starts: `bun run dev`,
`bun test` and scripts all see `Bun.env.DATABASE_URL`. No package and no
command-line flag is needed. (Deno needed `--env-file` and `--allow-env`.)

`config.ts` reads every variable in one place and refuses to start if a
required one is missing:

```ts
function required(name: string): string {
  const value = Bun.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env …`);
  return value;
}
export const DATABASE_URL = required("DATABASE_URL");
```

The rule: configuration that differs between machines, and anything secret,
lives in the environment. `.env.example` (committed) documents which variables
exist; `.env` (not committed) holds the real values.

### Connecting: Bun's built-in `SQL`

```ts
import { SQL } from "bun";

export const sql = new SQL({ url: DATABASE_URL, max: 10, idleTimeout: 30 });
```

Bun includes a PostgreSQL client, so there is no driver to install. The `SQL`
object is a **connection pool**: it opens up to `max` connections (lazily, on
first use) and lends one to each query. Opening a connection takes far longer
than running a simple query, so reusing them matters.

Only repositories import `db/client.ts`. The router and services never see the
database.

### Parameterised queries with tagged templates

```ts
const rows = await sql<UploadRow[]>`
  delete from uploads
  where id = ${id}
  returning id, filename, original_name, mime_type, size, uploaded_at
`;
```

This looks like a template string, but `sql` is a **tag function**. JavaScript
calls it with the fixed text parts and the `${}` values *separately*:

```
strings: ["\n  delete from uploads\n  where id = ", "\n  returning …"]
values:  ["3f1c2b9e-…"]
```

Bun sends the text to PostgreSQL with placeholders (`where id = $1`) and the
values as separate parameters. The database parses the SQL first and only then
plugs in the values, so a value can never change the structure of the query.
A file named `x'); drop table uploads; --.png` is stored as exactly that name;
a test proves it.

Week 11 shows the opposite: SQL built by gluing strings together, and the
injection attack it allows.

The type argument `sql<UploadRow[]>` tells TypeScript what the rows look like.
TypeScript cannot check this against the real table, so the row type must be
kept in sync with the `select` list by hand.

`returning` makes `insert`, `update` and `delete` give back the affected rows.
That saves a second query: the insert returns the `uploaded_at` the database
generated, and the delete returns the deleted row (the service needs its file
name).

### Mapping rows to API objects

The database and the API speak different dialects:

| Database row (`UploadRow`) | API object (`UploadRecord`) |
| -------------------------- | --------------------------- |
| `original_name` | `originalName` |
| `mime_type` | `mimeType` |
| `uploaded_at: Date` | `uploadedAt: string` (ISO 8601) |
| – | `url` (derived from `filename`) |

`toUploadRecord(row)` converts one to the other, and it is the only place that
knows both. The row type describes the table; it is an **entity** and never
leaves the repository. The API type is part of the shared contract. Week 8
gives these two roles their usual names: *entity* and *DTO*.

### The layers

```
HTTP request
   │
   ▼
router.ts        parse the request, validate the id, choose the status code
   │
   ▼
upload-service   rules: allowed types, generated file names, delete order
   │
   ▼
repository       SQL, row ↔ object mapping
   │
   ▼
PostgreSQL
```

Each layer only talks to the one below. Swapping the database for another
touches the repository only; changing the response format touches the router
only.

### Order of operations across two systems

Deleting an image changes two systems, the database and the disk, and either
step can fail. The service deletes the **row first**, then the file:

- row deleted, file deletion fails → an unused file on disk. Invisible and
  harmless; a cleanup job could remove it.
- (the other order) file deleted, row deletion fails → a gallery entry with a
  broken image.

Uploading is handled the same way: if inserting the row fails, the
freshly-written file is removed again. Reasoning about partial failure like
this matters whenever one request touches more than one system.

### Validate before querying, and catch the unexpected

`DELETE /api/uploads/not-a-uuid` is rejected with `400` by `isUuid()` before
any SQL runs. Without the check, PostgreSQL itself rejects the value
(`invalid input syntax for type uuid`), and last year's version sent that
database error text to the client.

For errors nobody anticipated (the database is down, a bug), `Bun.serve` takes
an `error` handler:

```ts
Bun.serve({
  ...,
  error(error) {
    console.error("Unhandled error:", error);   // full details in the server log
    return fail("Internal server error", 500);  // nothing internal leaks to the client
  },
});
```

Try it: stop the database (`docker compose stop postgres`) and reload the
client.

## Lecture walkthrough

1. Start PostgreSQL. Write `sql/schema.sql` and apply it with `psql` or with
   `bun run db:setup`. Insert a row by hand and query it.
2. `.env.example` → `.env`, then `config.ts`. Show the error when `.env` is
   missing.
3. `db/client.ts`, then the repository: `UploadRow`, `toUploadRecord`,
   `insertUpload`, `listUploads`, `deleteUploadById`. Explain tagged
   templates and `returning`.
4. Update the service: replace the JSON file with repository calls, add
   `deleteUploadedImage` and discuss the order of operations.
5. Router: the `DELETE` route with `isUuid`, CORS for `DELETE`, the `error`
   handler.
6. Client: `deleteImage()` in `api.ts`, the button in `Gallery`, `deletingId`
   and `handleDelete` in `App`.
7. Verify: upload, restart the API, the gallery is still there; delete, check
   the row and the file are both gone.

## Compared with last year's Deno version

- Bun's built-in `SQL` replaces `jsr:@db/postgres`; there are no
  `pool.connect()`/`client.release()` pairs to forget.
- The connection string comes from `.env` (loaded automatically) instead of
  being written in the source code.
- Malformed ids get `400` instead of a database error message; unexpected
  errors get a generic `500` JSON response.
- The upload time and the deleted row come from `returning`; the
  find-then-delete pair became one statement.
- A failed insert no longer leaves an orphaned file.

## Exercises

1. Add pagination: `GET /api/uploads?limit=20&offset=40`. Validate both
   numbers, use them in the query (`limit ${limit} offset ${offset}`), and
   return the total count as well (`select count(*) …`).
2. Add a `title` column that the user can edit with `PATCH /api/uploads/:id`.
   Write the `alter table` statement and think about existing rows.
3. Wrap the delete in a transaction:
   `await sql.begin(async (tx) => { … })`. Delete the row inside it, delete the
   file, and let an exception roll the row back. Which failure case does this
   fix, and which one remains?
4. Write a test for the 500 handler: make the repository throw (hint:
   `spyOn` on the repository module) and check the response body has no
   internal details.

## Further reading

- [Bun: SQL (PostgreSQL client)](https://bun.sh/docs/runtime/sql)
- [Bun: Environment variables](https://bun.sh/docs/runtime/environment-variables)
- [PostgreSQL tutorial](https://www.postgresql.org/docs/current/tutorial.html)
- [PostgreSQL: Data types (uuid, timestamptz, text)](https://www.postgresql.org/docs/current/datatype.html)
- [MDN: Tagged templates](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates)
- [The Twelve-Factor App: Config](https://12factor.net/config)
