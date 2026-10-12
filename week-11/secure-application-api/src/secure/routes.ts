/**
 * ✅  THE SECURE VERSION: the same endpoints as ../vulnerable/routes.ts, fixed.
 *
 * Each fix is labelled with the OWASP Top 10:2025 category it addresses.
 * Compare the two files side by side:
 *
 *   git diff --no-index src/vulnerable/routes.ts src/secure/routes.ts
 */
import type { BunRequest, Server } from "bun";
import { ALLOWED_ORIGIN } from "../config";
import { secureSql as sql } from "../db";
import { json, readJson } from "../http";
import { authenticate, signToken, type AuthUser } from "./auth";
import { RateLimiter } from "./rate-limiter";

// ---------------------------------------------------------------------------
// FIX A02: CORS is restricted to the one origin that hosts our client, and to
// the methods and headers it actually uses. A few defensive headers are added
// to every response as well.
// ---------------------------------------------------------------------------
function securityHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff", // never guess content types
    "Cache-Control": "no-store", // do not cache API answers (they contain personal data)
  };
}

function send(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return json(data, status, { ...securityHeaders(), ...extraHeaders });
}

// FIX A01: one helper that every protected route uses. The role comes from the
// database record of the token's user, never from the request.
type Guarded<Req extends Request> = (req: Req, user: AuthUser) => Promise<Response>;

function requireUser<Req extends Request>(handler: Guarded<Req>, role?: "admin") {
  return async (req: Req): Promise<Response> => {
    const user = await authenticate(req);
    if (!user) return send({ ok: false, error: "Unauthorized" }, 401);
    if (role && user.role !== role) return send({ ok: false, error: "Forbidden" }, 403);
    return handler(req, user);
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// FIX A07: a real password policy for new passwords.
// ---------------------------------------------------------------------------
function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

// (The debug endpoint is simply gone. FIX A02: debug tooling never ships.)

// ---------------------------------------------------------------------------
// POST /api/register
// ---------------------------------------------------------------------------
async function register(req: Request): Promise<Response> {
  const body = await readJson(req);
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return send({ ok: false, error: "Invalid request body" }, 400);
  }

  const email = body.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return send({ ok: false, error: "Invalid email address" }, 400);
  }
  if (!isStrongPassword(body.password)) {
    return send(
      { ok: false, error: "Password must be at least 8 characters and include upper- and lowercase letters, a number and a special character" },
      400,
    );
  }

  const existing = await sql`select 1 from users where email = ${email}`;
  if (existing.length > 0) {
    // Registration has to say *something* when the email is taken. Production
    // systems often answer "check your inbox" either way and send the details
    // by email, so that this endpoint cannot be used to enumerate accounts.
    return send({ ok: false, error: "Email already in use" }, 409);
  }

  // FIX A04: store a salted, slow hash (Argon2id), never the password.
  const id = crypto.randomUUID();
  const passwordHash = await Bun.password.hash(body.password);
  await sql`insert into users (id, email, password_hash, role) values (${id}, ${email}, ${passwordHash}, ${"user"})`;

  return send({ ok: true, data: { id, email } }, 201);
}

// ---------------------------------------------------------------------------
// POST /api/login
// ---------------------------------------------------------------------------
// FIX A07: at most 5 login attempts per IP address and email per 15 minutes
// (a successful login resets the count).
export const loginLimiter = new RateLimiter(5, 15 * 60 * 1000);

// A hash of a random password, compared against when the email is unknown. Then
// "unknown email" takes as long as "wrong password", and response times do not
// reveal which emails exist either.
const DUMMY_HASH = await Bun.password.hash(crypto.randomUUID());

async function login(req: Request, server: Server<undefined>): Promise<Response> {
  const body = await readJson(req);
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return send({ ok: false, error: "Invalid request body" }, 400);
  }

  const email = body.email.trim().toLowerCase();
  const ip = server.requestIP(req)?.address ?? "unknown";
  const limiterKey = `${ip}|${email}`;

  // Count the attempt now, before the slow password check (see rate-limiter.ts).
  const limit = loginLimiter.consume(limiterKey);
  if (!limit.allowed) {
    return send({ ok: false, error: "Too many login attempts. Try again later." }, 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const rows = await sql<{ id: string; password_hash: string }[]>`
    select id, password_hash from users where email = ${email}
  `;
  const user = rows[0];

  // FIX A04: verify against the hash. FIX A07: same work, same answer, whether
  // or not the user exists.
  const passwordOk = await Bun.password.verify(body.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    return send({ ok: false, error: "Invalid email or password" }, 401);
  }

  loginLimiter.reset(limiterKey);
  // FIX A04 + A07: a signed, expiring token instead of Base64 JSON.
  return send({ ok: true, data: { token: await signToken(user.id) } });
}

// ---------------------------------------------------------------------------
// GET /api/users/search?email=… (signed-in users only)
// FIX A05: a parameterised query. The value can never change the SQL.
// Also: no password column, no "executedQuery" in the response, and exact-match
// lookups only for authenticated users (no anonymous directory of users).
// ---------------------------------------------------------------------------
const searchUsers = requireUser(async (req: Request) => {
  const email = (new URL(req.url).searchParams.get("email") ?? "").trim().toLowerCase();
  const rows = await sql`select id, email, role from users where email = ${email}`;
  return send({ ok: true, data: rows });
});

// ---------------------------------------------------------------------------
// GET /api/admin/audit
// FIX A01: the admin check uses the authenticated user's role from the
// database. Any ?role=… in the URL is simply ignored.
// ---------------------------------------------------------------------------
const adminAudit = requireUser(async () => {
  return send({
    ok: true,
    data: {
      message: "Top secret admin audit log",
      logs: ["Deleted 4 users", "Exported monthly report", "Viewed all private notes"],
    },
  });
}, "admin");

// ---------------------------------------------------------------------------
// GET /api/notes/:id
// FIX A01: only the owner (or an admin) may read a note. Everyone else gets
// 404, not 403, so they cannot even learn that the id exists.
// ---------------------------------------------------------------------------
const getNote = requireUser(async (req: BunRequest<"/api/notes/:id">, user) => {
  const { id } = req.params;
  if (!UUID_PATTERN.test(id)) return send({ ok: false, error: "Note not found" }, 404);

  const rows = await sql<{ id: string; title: string; content: string; owner_id: string }[]>`
    select id, title, content, owner_id from notes where id = ${id}
  `;
  const note = rows[0];
  if (!note || (note.owner_id !== user.id && user.role !== "admin")) {
    return send({ ok: false, error: "Note not found" }, 404);
  }

  return send({ ok: true, data: note });
});

// ---------------------------------------------------------------------------
// DELETE /api/users/:id
// FIX A01: authentication and the admin role are required.
// ---------------------------------------------------------------------------
const deleteUser = requireUser(async (req: BunRequest<"/api/users/:id">, admin) => {
  const { id } = req.params;
  if (!UUID_PATTERN.test(id)) return send({ ok: false, error: "Invalid user id" }, 400);
  if (id === admin.id) return send({ ok: false, error: "Admins cannot delete themselves" }, 400);

  const result = await sql`delete from users where id = ${id}`;
  if (result.count === 0) return send({ ok: false, error: "User not found" }, 404);
  return send({ ok: true, message: `User ${id} deleted` });
}, "admin");

export const routes = {
  "/api/register": { POST: register },
  "/api/login": { POST: login },
  "/api/users/search": { GET: searchUsers },
  "/api/admin/audit": { GET: adminAudit },
  "/api/notes/:id": { GET: getNote },
  "/api/users/:id": { DELETE: deleteUser },
};

export function fallback(req: Request): Response {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: securityHeaders() });
  return send({ ok: false, error: "Not found" }, 404);
}

// ---------------------------------------------------------------------------
// FIX A02 / A10: log the details on the server, give the client nothing it
// could use to map the system.
// ---------------------------------------------------------------------------
export function errorHandler(error: Error): Response {
  console.error("Internal server error:", error);
  return send({ ok: false, error: "Internal server error" }, 500);
}
