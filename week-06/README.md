# Week 6 – SQL database

Week 5 stored image metadata in a JSON file and ended with a list of reasons
why that does not scale. This week the **Image Gallery v2** moves the metadata
into **PostgreSQL**. The image files stay on disk (week 12 moves them to cloud
storage). Users can now also delete images. Everything else in week 5's
lecture app stays as it was: the request logger, the cached images (`ETag`,
`304`, `Range`) and the live viewer count over the WebSocket.

The new back-end topics: running PostgreSQL in a **Docker container**,
connecting to it with Bun's built-in SQL client, **parameterised queries**,
**mapping database rows** to application objects, the **repository layer**,
and configuration through **environment variables**.

## Learning objectives

After this week you can:

- explain what a Docker image, container and volume are, and why the course runs PostgreSQL in a container
- start PostgreSQL with Docker Compose and create a schema from an SQL file
- connect to PostgreSQL with Bun's built-in `SQL` client and a connection pool
- write parameterised queries with tagged templates and explain why they prevent SQL injection
- map database rows (snake_case, `Date`) to API objects (camelCase, ISO strings)
- structure a back-end as router → service → repository → database
- keep configuration and secrets in `.env`, outside the code
- validate ids before they reach the database, and handle unexpected errors centrally

## What you build

Week 5's API plus one endpoint, `DELETE`. The other routes behave exactly as
in week 5; what changed is where the metadata is kept:

| Method | Path | Success | Errors |
| ------ | ---- | ------- | ------ |
| `GET` | `/api/uploads` | `200` `UploadRecord[]`, newest first | – |
| `POST` | `/api/uploads` | `201` the `UploadRecord` | `400`, `413`, `415` |
| `DELETE` | `/api/uploads/:id` | `200` the deleted `UploadRecord` | `400` malformed id, `404` unknown |
| `GET` | `/uploads/:filename` | `200` the image (`304` for a matching `If-None-Match`, `206` for a `Range`) | `400`, `404` |
| `GET` | `/ws` | `101`: a WebSocket that receives the viewer count (`ServerMessage`) | `426` not an upgrade |

The viewer count still lives in a variable in the API process, not in the
database: it describes who is connected right now, and it is lost on a restart
on purpose. The uploads are the data that must survive, so they go to
PostgreSQL.

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
bun test                      # 9 integration tests against the database

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
│   ├── main.ts                    Bun.serve with middleware, the WebSocket and an error handler
│   ├── config.ts                  reads and checks environment variables
│   ├── router.ts                  HTTP only: parse, call the service, choose the status
│   ├── realtime.ts                websocket handlers: the live viewer count (from week 5)
│   ├── db/
│   │   └── client.ts              the SQL connection pool
│   ├── repositories/
│   │   └── upload-repository.ts   SQL queries + row → UploadRecord mapping
│   ├── services/
│   │   └── upload-service.ts      rules: validation, files on disk, delete order
│   ├── middleware/                withLogging, applyMiddleware (from week 5)
│   └── util/
│       ├── response.ts            ok(), fail(), corsHeaders() (+ DELETE)
│       ├── http-cache.ts          etagMatches(), notModified() (from week 5)
│       └── validation.ts          isUuid()
└── tests/uploads.test.ts
```

`shared/` holds `types.ts`, `upload-rules.ts` and `socket-messages.ts`, all
unchanged from week 5. The client is week 5's, *Live* indicator and
`hooks/useGallerySocket.ts` included, plus a delete button (`Gallery.tsx`,
`App.tsx`, `api.ts`).

---

## Concepts

### Docker and containers

PostgreSQL is a server program. Installed directly on every laptop, it would
come in a different version with different settings on each machine, keep
running in the background after the course, and need its own installer on
Windows. The course runs it in a **container** instead.

| Term | What it is |
| ---- | ---------- |
| **Image** | A packaged program with everything it needs to run. Ours is `postgres:18-alpine`: PostgreSQL 18 on a small Linux. Downloaded once from Docker Hub. |
| **Container** | A running instance of an image, isolated from the rest of the computer. It can be stopped, removed and recreated in seconds. |
| **Volume** | Storage that Docker keeps outside the container. The database files live there, so removing the container does not remove the data. |
| **Port mapping** | `"5432:5432"` forwards `localhost:5432` on your computer to port 5432 inside the container. |

A container is not a virtual machine. It shares the host's Linux kernel and
starts in about a second. On macOS and Windows, Docker Desktop runs one small
Linux virtual machine in the background, and every container runs inside it.

Why the course uses it:

- Everyone gets the same PostgreSQL 18 with the same user, password and
  databases, on any operating system.
- Nothing is installed permanently. `docker compose down -v` removes the
  database completely, and the next `up` starts a fresh one.
- Week 12 deploys the finished app to a cloud server with the same tool,
  Docker Compose.

**Installing.** Docker Desktop on macOS and Windows (on Windows it uses
WSL 2), Docker Engine with the Compose plugin on Linux:
<https://docs.docker.com/get-started/get-docker/>. Check the installation with
`docker --version` and `docker compose version`. [docs/setup.md](../docs/setup.md)
lists the course's other tools.

### PostgreSQL in Docker

`docker compose` reads `docker-compose.yml` in the repository root. The part
for PostgreSQL:

```yaml
services:
  postgres:
    image: postgres:18-alpine          # which image to run
    container_name: awa-postgres       # the name docker exec uses
    environment:
      POSTGRES_USER: postgres          # the image creates this user
      POSTGRES_PASSWORD: postgres      # with this password (local use only)
    ports:
      - "5432:5432"                    # localhost:5432 → port 5432 in the container
    volumes:
      - postgres-data:/var/lib/postgresql   # the data survives restarts
      - ./docker/postgres-init.sql:/docker-entrypoint-initdb.d/01-create-databases.sql:ro
```

`docker compose up -d` downloads the image the first time, creates the volume
and starts the container in the background (`-d` for *detached*). On the very
first start, with an empty volume, the image runs `docker/postgres-init.sql`,
which creates one database per week. This week uses `image_gallery`. The same
file also starts SeaweedFS, the object storage for week 12.

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

This looks like a template string, but no string is built here. `sql` is a
**tag function**, and a tagged template is a function call. Three things
happen:

1. **JavaScript calls the tag.** It cuts the template at every `${}` and calls
   `sql(strings, ...values)`: the fixed text in one array, the values in
   another. Try it with a tag of your own:

   ```ts
   function show(strings: TemplateStringsArray, ...values: unknown[]) {
     console.log({ strings: [...strings], values });
   }
   show`delete from uploads where id = ${id} returning id, filename`;
   // { strings: [ "delete from uploads where id = ", " returning id, filename" ],
   //   values:  [ "3f1c2b9e-8d4a-4c1e-9b7a-2f6d5e4c3b2a" ] }
   ```

2. **Bun sends the two parts separately.** It joins the text parts with
   numbered placeholders (`$1`, `$2`, …) and sends that text to PostgreSQL.
   The values travel next to it as a list of *parameters*. With statement
   logging switched on, PostgreSQL's own log shows exactly this:

   ```
   LOG:     execute P1: delete from uploads where id = $1  returning id, filename, original_name, uploaded_at
   DETAIL:  Parameters: $1 = '3f1c2b9e-8d4a-4c1e-9b7a-2f6d5e4c3b2a'
   ```

3. **PostgreSQL parses the text first, then fills in the values.** The shape
   of the statement is fixed before any value is looked at. A parameter is
   only ever data (a uuid to compare, a text to store); it can never become a
   keyword, a quote or a second statement.

That is why the test that uploads a file called `x'); drop table uploads; --.png`
passes. The name arrives as a parameter and is stored as an ordinary name:

```
LOG:     execute P0: select id from uploads where original_name = $1
DETAIL:  Parameters: $1 = 'x''); drop table uploads; --.png'
```

(The log doubles the quote when it prints a value; the stored name has one.)

Compare SQL built by gluing strings together:

```ts
sql.unsafe("insert into uploads (original_name) values ('" + name + "')");
// PostgreSQL receives:
//   insert into uploads (original_name) values ('x'); drop table uploads; --.png')
```

Now the value is part of the SQL text. Its quote ends the string, `);` ends
the insert, `drop table uploads;` is a second statement, and `--` turns the
rest into a comment. The value has changed what the query does: that is **SQL
injection**. Week 11 shows the attack in full.

The type argument `sql<UploadRow[]>` tells TypeScript what the rows look like.
TypeScript cannot check this against the real table, so the row type must be
kept in sync with the `select` list by hand.

### `returning`: the changed row comes back

`insert`, `update` and `delete` normally report only how many rows they
changed (`INSERT 0 1`). With `returning` they also give back the rows
themselves, as if a `select` ran in the same statement. In `psql`:

```
image_gallery=# insert into uploads (id, filename, original_name, mime_type, size)
                values ('3f1c2b9e-8d4a-4c1e-9b7a-2f6d5e4c3b2a', '3f1c2b9e-8d4a-4c1e-9b7a-2f6d5e4c3b2a.png',
                        'cat.png', 'image/png', 5120)
                returning id, original_name, size, uploaded_at;
                  id                  | original_name | size |          uploaded_at
--------------------------------------+---------------+------+-------------------------------
 3f1c2b9e-8d4a-4c1e-9b7a-2f6d5e4c3b2a | cat.png       | 5120 | 2026-11-26 09:52:21.764323+00
(1 row)

INSERT 0 1
```

The insert never sent `uploaded_at`. The column's `default now()` filled it in,
and `returning` hands it back. In `insertUpload` the same statement gives Bun
an array with one row object, and `toUploadRecord` turns that row into the
`UploadRecord` the API answers with. Without `returning`, the API would need a
second query to learn the time. The delete works the same way:
`delete … returning …` gives back the row it removed, and the service needs
its `filename` to remove the file.

### Mapping rows to API objects

The repository receives rows from PostgreSQL, but the rest of the app works
with `UploadRecord`, the shared API type from `shared/types.ts`. Both describe
the same image in different shapes. Here is one image as Bun returns the row
(`console.log(rows[0])`) and as the API sends it:

```
Row from PostgreSQL (UploadRow)               JSON from the API (UploadRecord)
{                                             {
  id: "3f1c2b9e-…",                             "id": "3f1c2b9e-…",
  filename: "3f1c2b9e-….png",                   "filename": "3f1c2b9e-….png",
  original_name: "cat.png",                     "originalName": "cat.png",
  mime_type: "image/png",                       "mimeType": "image/png",
  size: 5120,                                   "size": 5120,
  uploaded_at: 2026-11-26T09:52:21.764Z,        "uploadedAt": "2026-11-26T09:52:21.764Z",
}                                               "url": "/uploads/3f1c2b9e-….png"
                                              }
```

| | Row | API object | Why they differ |
| - | --- | ---------- | --------------- |
| Names | `original_name`, `mime_type`, `uploaded_at` | `originalName`, `mimeType`, `uploadedAt` | SQL uses snake_case: PostgreSQL folds unquoted names to lower case, so a column called `originalName` would become `originalname`. JavaScript uses camelCase. |
| Time | a JavaScript `Date` | an ISO 8601 string | JSON has no date type. The string format is part of the contract the client relies on. |
| `url` | not stored | `/uploads/<filename>` | It can be derived from `filename`. Storing it too would be duplicate data that could go out of sync. |

`toUploadRecord(row)` does the conversion, and it is the only code that knows
both shapes:

```ts
function toUploadRecord(row: UploadRow): UploadRecord {
  return {
    id: row.id,
    filename: row.filename,
    originalName: row.original_name,
    mimeType: row.mime_type,
    size: row.size,
    uploadedAt: row.uploaded_at.toISOString(),
    url: `/uploads/${row.filename}`,
  };
}
```

Every repository function returns `UploadRecord`s, never rows. If a column is
renamed, only the repository changes and the client never notices. The row
type describes the table; it is an **entity** and never leaves the repository.
The API type is part of the shared contract. Week 8 gives these two roles
their usual names: *entity* and *DTO*.

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

1. Docker: image, container, volume, and why the course uses them. Then
   `docker compose up -d`, `docker compose ps`, and `docker exec … psql` into
   the container.
2. Write `sql/schema.sql` and apply it with `psql` or with
   `bun run db:setup`. Insert a row by hand with `returning`, and query it.
3. `.env.example` → `.env`, then `config.ts`. Show the error when `.env` is
   missing.
4. `db/client.ts`, then the repository: `UploadRow`, `toUploadRecord`,
   `insertUpload`, `listUploads`, `deleteUploadById`. Explain tagged
   templates with the `show` tag above, and `returning`.
5. Update the service: replace the JSON file with repository calls, add
   `deleteUploadedImage` and discuss the order of operations.
6. Router: the `DELETE` route with `isUuid`, CORS for `DELETE`, the `error`
   handler. The image route and `/ws` are unchanged from week 5.
7. Client: `deleteImage()` in `api.ts`, the button in `Gallery`, `deletingId`
   and `handleDelete` in `App`.
8. Verify: upload, restart the API, the gallery is still there (the viewer
   count starts again from zero: it was only in memory); delete, check the
   row and the file are both gone.

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
   numbers, do the paging in SQL rather than in JavaScript, and send the total
   number of uploads as well.
2. Add a `title` column that the user can edit with `PATCH /api/uploads/:id`.
   Add it with an `alter table` statement that also works on a database that
   already has images in it, and think about the existing rows.
3. Make the delete safe with a transaction (`sql.begin` in Bun's SQL client):
   if removing the file fails, the row must stay. Which failure case does this
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
