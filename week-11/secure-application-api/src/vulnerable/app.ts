/**
 * ⚠️  THE VULNERABLE VERSION. Every mistake in this file is deliberate. ⚠️
 *
 * Each route is labelled with the OWASP Top 10:2025 category it violates.
 * The fixed version of the same endpoint is in ../secure/app.ts; compare
 * them side by side:
 *
 *   git diff --no-index src/vulnerable/app.ts src/secure/app.ts
 *
 * Both versions are Elysia apps, like the APIs since week 8. A framework does
 * not make an API secure: everything below is just as broken in Elysia as it
 * was with Bun.serve. Never copy code from this file into a real application.
 */
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { VULNERABLE_DATABASE_URL } from "../config";
import { vulnerableSql as sql } from "../db";

// The request body as the client sent it: an object, or null for anything else.
// No schema: this version checks (some of) its input by hand.
function asObject(body: unknown): Record<string, unknown> | null {
  return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

// ---------------------------------------------------------------------------
// A04 CRYPTOGRAPHIC FAILURES + A07 AUTHENTICATION FAILURES: the "token" is
// JSON encoded as Base64. Encoding is not encryption and not a signature:
// anyone can decode it, edit the role and encode it again.
// ---------------------------------------------------------------------------
type FakeTokenUser = { userId: string; email: string; role: string };

function makeToken(user: FakeTokenUser): string {
  return btoa(JSON.stringify(user));
}

function readToken(authorization: string | undefined): FakeTokenUser | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  try {
    return JSON.parse(atob(authorization.slice(7))) as FakeTokenUser; // trusted blindly
  } catch {
    return null;
  }
}

export const app = new Elysia()
  // -------------------------------------------------------------------------
  // A02 SECURITY MISCONFIGURATION: CORS allows every origin, method and
  // header. Any website a user visits can call this API from their browser
  // and read the answers (see CORS-test.html in the client project).
  // -------------------------------------------------------------------------
  .use(cors({ origin: "*", methods: "*", allowedHeaders: "*" }))

  // -------------------------------------------------------------------------
  // A02 SECURITY MISCONFIGURATION (and A10 Mishandling of Exceptional
  // Conditions): internal errors go to the client verbatim: the database
  // error with table and constraint names, and the stack trace with file
  // paths.
  // -------------------------------------------------------------------------
  .onError(({ code, error, status }) => {
    if (code === "NOT_FOUND") return status(404, { ok: false, error: "Not found" });
    const err = error instanceof Error ? error : new Error(String(error));
    return status(500, { ok: false, error: String(err), stack: err.stack ?? null });
  })

  // -------------------------------------------------------------------------
  // GET /api/debug/config
  // A02 SECURITY MISCONFIGURATION: a debug endpoint left enabled in
  // "production". It hands out the database password and the signing secret
  // to anyone.
  // -------------------------------------------------------------------------
  .get("/api/debug/config", () => ({
    ok: true,
    environment: {
      mode: "development",
      databaseUrl: VULNERABLE_DATABASE_URL,
      // A secret hard-coded in the source code: anyone with access to the
      // repository (or this endpoint) has it.
      sessionSecret: "super-secret-demo-key",
      bunVersion: Bun.version,
      workingDirectory: process.cwd(),
    },
  }))

  // -------------------------------------------------------------------------
  // POST /api/register
  // A07: the only password rule is "at least 4 characters".
  // A04: the password is stored in plain text.
  // A02: database errors are sent to the client (see onError above).
  // -------------------------------------------------------------------------
  .post("/api/register", async ({ body, status }) => {
    const input = asObject(body);
    if (!input || typeof input.email !== "string" || typeof input.password !== "string") {
      return status(400, { ok: false, error: "Invalid request body" });
    }

    const email = input.email.trim().toLowerCase();
    const password = input.password;

    if (password.length < 4) {
      return status(400, { ok: false, error: "Password must be at least 4 characters" });
    }

    const id = crypto.randomUUID();
    // A duplicate email throws a database error. Nothing catches it here, so
    // it reaches onError above, which prints it for the attacker.
    await sql`insert into users (id, email, password, role) values (${id}, ${email}, ${password}, ${"user"})`;

    return status(201, { ok: true, data: { id, email } });
  })

  // -------------------------------------------------------------------------
  // POST /api/login
  // A07: different answers for "no such user" (404) and "wrong password"
  //      (401) tell an attacker which emails are registered (user enumeration).
  // A07: no limit on attempts: a password list can be tried at full speed.
  // A04: plain-text comparison, and the unsigned token from above.
  // -------------------------------------------------------------------------
  .post("/api/login", async ({ body, status }) => {
    const input = asObject(body);
    if (!input || typeof input.email !== "string" || typeof input.password !== "string") {
      return status(400, { ok: false, error: "Invalid request body" });
    }

    const rows = await sql<{ id: string; email: string; password: string; role: string }[]>`
      select id, email, password, role from users where email = ${input.email.trim().toLowerCase()}
    `;
    const user = rows[0];

    if (!user) {
      return status(404, { ok: false, error: "User does not exist" });
    }
    if (user.password !== input.password) {
      return status(401, { ok: false, error: "Wrong password" });
    }

    return { ok: true, data: { token: makeToken({ userId: user.id, email: user.email, role: user.role }) } };
  })

  // -------------------------------------------------------------------------
  // GET /api/users/search?email=…
  // A05 INJECTION: user input is pasted into the SQL text. The input
  //   ' OR '1'='1
  // turns the condition into `where email = '' OR '1'='1'`: true for every
  // row. The query also selects the passwords, and the response even shows
  // the SQL.
  // -------------------------------------------------------------------------
  .get("/api/users/search", async ({ query }) => {
    const email = query.email ?? "";

    const text = `select id, email, role, password from users where email = '${email}'`;
    const rows = await sql.unsafe(text); // sql.unsafe runs a raw string: no parameters

    return { ok: true, data: rows, executedQuery: text };
  })

  // -------------------------------------------------------------------------
  // GET /api/admin/audit?role=admin
  // A01 BROKEN ACCESS CONTROL: the server asks the *client* whether it is an
  // admin. Changing ?role=user to ?role=admin is all it takes.
  // -------------------------------------------------------------------------
  .get("/api/admin/audit", ({ query, status }) => {
    if (query.role !== "admin") {
      return status(403, { ok: false, error: "Forbidden" });
    }

    return {
      ok: true,
      data: {
        message: "Top secret admin audit log",
        logs: ["Deleted 4 users", "Exported monthly report", "Viewed all private notes"],
      },
    };
  })

  // -------------------------------------------------------------------------
  // GET /api/notes/:id
  // A01 BROKEN ACCESS CONTROL (IDOR / BOLA): any logged-in user can read any
  // note by changing the id in the URL. Nobody checks who owns it.
  // A07: the "logged-in user" comes from the forgeable token.
  // -------------------------------------------------------------------------
  .get("/api/notes/:id", async ({ params, headers, status }) => {
    const currentUser = readToken(headers.authorization);
    if (!currentUser) return status(401, { ok: false, error: "Missing token" });

    const rows = await sql`select id, title, content, owner_id from notes where id = ${params.id}`;
    if (rows.length === 0) return status(404, { ok: false, error: "Note not found" });

    return { ok: true, currentUser, data: rows[0] };
  })

  // -------------------------------------------------------------------------
  // DELETE /api/users/:id
  // A01 BROKEN ACCESS CONTROL: no authentication and no authorisation at all.
  // Anyone who can reach the API can delete any account.
  // -------------------------------------------------------------------------
  .delete("/api/users/:id", async ({ params }) => {
    await sql`delete from users where id = ${params.id}`;
    return { ok: true, message: `User ${params.id} deleted` };
  });
