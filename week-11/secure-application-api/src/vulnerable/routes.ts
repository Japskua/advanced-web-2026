/**
 * ⚠️  THE VULNERABLE VERSION. Every mistake in this file is deliberate. ⚠️
 *
 * Each handler is labelled with the OWASP Top 10:2025 category it violates.
 * The fixed version of the same endpoint is in ../secure/routes.ts; compare
 * them side by side:
 *
 *   git diff --no-index src/vulnerable/routes.ts src/secure/routes.ts
 *
 * Never copy code from this file into a real application.
 */
import type { BunRequest } from "bun";
import { VULNERABLE_DATABASE_URL } from "../config";
import { vulnerableSql as sql } from "../db";
import { json, readJson } from "../http";

// ---------------------------------------------------------------------------
// A02 SECURITY MISCONFIGURATION: CORS allows every origin, method and header.
// Any website a user visits can call this API from their browser and read the
// answers (see CORS-test.html in the client project).
// ---------------------------------------------------------------------------
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Headers": "*",
  };
}

function send(data: unknown, status = 200): Response {
  return json(data, status, corsHeaders());
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

function readToken(req: Request): FakeTokenUser | null {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return JSON.parse(atob(header.slice(7))) as FakeTokenUser; // trusted blindly
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// A02 SECURITY MISCONFIGURATION: a debug endpoint left enabled in "production".
// It hands out the database password and the signing secret to anyone.
// ---------------------------------------------------------------------------
function debugConfig(): Response {
  return send({
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
  });
}

// ---------------------------------------------------------------------------
// POST /api/register
// A07: the only password rule is "at least 4 characters".
// A04: the password is stored in plain text.
// A02: database errors are sent to the client (see the error handler).
// ---------------------------------------------------------------------------
async function register(req: Request): Promise<Response> {
  const body = await readJson(req);
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return send({ ok: false, error: "Invalid request body" }, 400);
  }

  const email = body.email.trim().toLowerCase();
  const password = body.password;

  if (password.length < 4) {
    return send({ ok: false, error: "Password must be at least 4 characters" }, 400);
  }

  const id = crypto.randomUUID();
  // A duplicate email throws a database error. Nothing catches it here, so it
  // reaches errorHandler below, which prints it for the attacker.
  await sql`insert into users (id, email, password, role) values (${id}, ${email}, ${password}, ${"user"})`;

  return send({ ok: true, data: { id, email } }, 201);
}

// ---------------------------------------------------------------------------
// POST /api/login
// A07: different answers for "no such user" (404) and "wrong password" (401)
//      tell an attacker which emails are registered (user enumeration).
// A07: no limit on attempts: a password list can be tried at full speed.
// A04: plain-text comparison, and the unsigned token from above.
// ---------------------------------------------------------------------------
async function login(req: Request): Promise<Response> {
  const body = await readJson(req);
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return send({ ok: false, error: "Invalid request body" }, 400);
  }

  const rows = await sql<{ id: string; email: string; password: string; role: string }[]>`
    select id, email, password, role from users where email = ${body.email.trim().toLowerCase()}
  `;
  const user = rows[0];

  if (!user) {
    return send({ ok: false, error: "User does not exist" }, 404);
  }
  if (user.password !== body.password) {
    return send({ ok: false, error: "Wrong password" }, 401);
  }

  return send({ ok: true, data: { token: makeToken({ userId: user.id, email: user.email, role: user.role }) } });
}

// ---------------------------------------------------------------------------
// GET /api/users/search?email=…
// A05 INJECTION: user input is pasted into the SQL text. The input
//   ' OR '1'='1
// turns the condition into `where email = '' OR '1'='1'`: true for every row.
// The query also selects the passwords, and the response even shows the SQL.
// ---------------------------------------------------------------------------
async function searchUsers(req: Request): Promise<Response> {
  const email = new URL(req.url).searchParams.get("email") ?? "";

  const query = `select id, email, role, password from users where email = '${email}'`;
  const rows = await sql.unsafe(query); // sql.unsafe runs a raw string: no parameters

  return send({ ok: true, data: rows, executedQuery: query });
}

// ---------------------------------------------------------------------------
// GET /api/admin/audit?role=admin
// A01 BROKEN ACCESS CONTROL: the server asks the *client* whether it is an
// admin. Changing ?role=user to ?role=admin is all it takes.
// ---------------------------------------------------------------------------
function adminAudit(req: Request): Response {
  if (new URL(req.url).searchParams.get("role") !== "admin") {
    return send({ ok: false, error: "Forbidden" }, 403);
  }

  return send({
    ok: true,
    data: {
      message: "Top secret admin audit log",
      logs: ["Deleted 4 users", "Exported monthly report", "Viewed all private notes"],
    },
  });
}

// ---------------------------------------------------------------------------
// GET /api/notes/:id
// A01 BROKEN ACCESS CONTROL (IDOR / BOLA): any logged-in user can read any
// note by changing the id in the URL. Nobody checks who owns it.
// A07: the "logged-in user" comes from the forgeable token.
// ---------------------------------------------------------------------------
async function getNote(req: BunRequest<"/api/notes/:id">): Promise<Response> {
  const currentUser = readToken(req);
  if (!currentUser) return send({ ok: false, error: "Missing token" }, 401);

  const rows = await sql`select id, title, content, owner_id from notes where id = ${req.params.id}`;
  if (rows.length === 0) return send({ ok: false, error: "Note not found" }, 404);

  return send({ ok: true, currentUser, data: rows[0] });
}

// ---------------------------------------------------------------------------
// DELETE /api/users/:id
// A01 BROKEN ACCESS CONTROL: no authentication and no authorisation at all.
// Anyone who can reach the API can delete any account.
// ---------------------------------------------------------------------------
async function deleteUser(req: BunRequest<"/api/users/:id">): Promise<Response> {
  await sql`delete from users where id = ${req.params.id}`;
  return send({ ok: true, message: `User ${req.params.id} deleted` });
}

export const routes = {
  "/api/debug/config": { GET: debugConfig },
  "/api/register": { POST: register },
  "/api/login": { POST: login },
  "/api/users/search": { GET: searchUsers },
  "/api/admin/audit": { GET: adminAudit },
  "/api/notes/:id": { GET: getNote },
  "/api/users/:id": { DELETE: deleteUser },
};

export function fallback(req: Request): Response {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  return send({ ok: false, error: "Not found" }, 404);
}

// ---------------------------------------------------------------------------
// A02 SECURITY MISCONFIGURATION (and A10 Mishandling of Exceptional
// Conditions): internal errors go to the client verbatim: the database error
// with table and constraint names, and the stack trace with file paths.
// ---------------------------------------------------------------------------
export function errorHandler(error: Error): Response {
  return send({ ok: false, error: String(error), stack: error.stack ?? null }, 500);
}
