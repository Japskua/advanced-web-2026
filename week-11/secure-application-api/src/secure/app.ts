/**
 * ✅  THE SECURE VERSION: the same endpoints as ../vulnerable/app.ts, fixed.
 *
 * Each fix is labelled with the OWASP Top 10:2025 category it addresses.
 * Compare the two files side by side:
 *
 *   git diff --no-index src/vulnerable/app.ts src/secure/app.ts
 */
import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { ALLOWED_ORIGIN } from "../config";
import { secureSql as sql } from "../db";
import { authenticate, signToken, type AuthUser } from "./auth";
import { RateLimiter } from "./rate-limiter";

// An error with an HTTP status, thrown by the access checks below and turned
// into a response by onError.
class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// FIX A05 (input validation): the shape of each request body is declared as a
// schema, and Elysia rejects anything else with 400 before the handler runs.
// ---------------------------------------------------------------------------
const credentialsBody = t.Object(
  {
    email: t.String({ error: "Invalid request body" }),
    password: t.String({ error: "Invalid request body" }),
  },
  { error: "Invalid request body" },
);

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

// ---------------------------------------------------------------------------
// FIX A10: errors are answered on purpose. Expected failures (401, 403) carry
// their status; anything else is logged on the server, and the client gets
// nothing it could use to map the system (FIX A02).
// ---------------------------------------------------------------------------
export function internalError(error: unknown): { ok: false; error: string } {
  console.error("Internal server error:", error);
  return { ok: false, error: "Internal server error" };
}

// FIX A07: at most 5 login attempts per IP address and email per 15 minutes
// (a successful login resets the count).
export const loginLimiter = new RateLimiter(5, 15 * 60 * 1000);

// A hash of a random password, compared against when the email is unknown. Then
// "unknown email" takes as long as "wrong password", and response times do not
// reveal which emails exist either.
const DUMMY_HASH = await Bun.password.hash(crypto.randomUUID());

export const app = new Elysia()
  // -------------------------------------------------------------------------
  // FIX A02: CORS is restricted to the one origin that hosts our client, and
  // to the methods and headers it actually uses. A few defensive headers are
  // added to every response as well.
  // -------------------------------------------------------------------------
  .use(
    cors({
      origin: ALLOWED_ORIGIN,
      methods: ["GET", "POST", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: [],
    }),
  )
  .headers({
    "X-Content-Type-Options": "nosniff", // never guess content types
    "Cache-Control": "no-store", // do not cache API answers (they contain personal data)
  })

  .error({ HttpError })
  .onError(({ code, error, status }) => {
    if (error instanceof HttpError) return status(error.status, { ok: false, error: error.message });
    switch (code) {
      case "VALIDATION":
        return status(400, { ok: false, error: typeof error.customError === "string" ? error.customError : "Invalid request" });
      case "PARSE":
        return status(400, { ok: false, error: "Invalid request body" });
      case "NOT_FOUND":
        return status(404, { ok: false, error: "Not found" });
    }
    return status(500, internalError(error));
  })

  // -------------------------------------------------------------------------
  // FIX A01: one access rule that every protected route uses, as an option
  // on the route (a macro, as in week 8). The role comes from the database
  // record of the token's user, never from the request.
  //
  //   { auth: true }       any signed-in user
  //   { role: "admin" }    signed-in admins only
  // -------------------------------------------------------------------------
  .macro({
    auth: {
      async resolve({ headers }) {
        const user = await authenticate(headers.authorization);
        if (!user) throw new HttpError(401, "Unauthorized");
        return { user };
      },
    },
    role: (role: AuthUser["role"]) => ({
      async resolve({ headers }) {
        const user = await authenticate(headers.authorization);
        if (!user) throw new HttpError(401, "Unauthorized");
        if (user.role !== role) throw new HttpError(403, "Forbidden");
        return { user };
      },
    }),
  })

  // (The debug endpoint is simply gone. FIX A02: debug tooling never ships.)

  // -------------------------------------------------------------------------
  // POST /api/register
  // -------------------------------------------------------------------------
  .post("/api/register", async ({ body, status }) => {
    const email = body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return status(400, { ok: false, error: "Invalid email address" });
    }
    if (!isStrongPassword(body.password)) {
      return status(400, {
        ok: false,
        error: "Password must be at least 8 characters and include upper- and lowercase letters, a number and a special character",
      });
    }

    const existing = await sql`select 1 from users where email = ${email}`;
    if (existing.length > 0) {
      // Registration has to say *something* when the email is taken.
      // Production systems often answer "check your inbox" either way and send
      // the details by email, so that this endpoint cannot be used to
      // enumerate accounts.
      return status(409, { ok: false, error: "Email already in use" });
    }

    // FIX A04: store a salted, slow hash (Argon2id), never the password.
    const id = crypto.randomUUID();
    const passwordHash = await Bun.password.hash(body.password);
    await sql`insert into users (id, email, password_hash, role) values (${id}, ${email}, ${passwordHash}, ${"user"})`;

    return status(201, { ok: true, data: { id, email } });
  }, { body: credentialsBody })

  // -------------------------------------------------------------------------
  // POST /api/login
  // -------------------------------------------------------------------------
  .post("/api/login", async ({ body, request, server, set, status }) => {
    const email = body.email.trim().toLowerCase();
    const ip = server?.requestIP(request)?.address ?? "unknown";
    const limiterKey = `${ip}|${email}`;

    // Count the attempt now, before the slow password check (see rate-limiter.ts).
    const limit = loginLimiter.consume(limiterKey);
    if (!limit.allowed) {
      set.headers["retry-after"] = String(limit.retryAfterSeconds);
      return status(429, { ok: false, error: "Too many login attempts. Try again later." });
    }

    const rows = await sql<{ id: string; password_hash: string }[]>`
      select id, password_hash from users where email = ${email}
    `;
    const user = rows[0];

    // FIX A04: verify against the hash. FIX A07: same work, same answer,
    // whether or not the user exists.
    const passwordOk = await Bun.password.verify(body.password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !passwordOk) {
      return status(401, { ok: false, error: "Invalid email or password" });
    }

    loginLimiter.reset(limiterKey);
    // FIX A04 + A07: a signed, expiring token instead of Base64 JSON.
    return { ok: true, data: { token: await signToken(user.id) } };
  }, { body: credentialsBody })

  // -------------------------------------------------------------------------
  // GET /api/users/search?email=… (signed-in users only)
  // FIX A05: a parameterised query. The value can never change the SQL.
  // Also: no password column, no "executedQuery" in the response, and
  // exact-match lookups only for authenticated users (no anonymous directory
  // of users).
  // -------------------------------------------------------------------------
  .get("/api/users/search", async ({ query }) => {
    const email = (query.email ?? "").trim().toLowerCase();
    const rows = await sql`select id, email, role from users where email = ${email}`;
    return { ok: true, data: rows };
  }, { auth: true })

  // -------------------------------------------------------------------------
  // GET /api/admin/audit
  // FIX A01: the admin check uses the authenticated user's role from the
  // database. Any ?role=… in the URL is simply ignored.
  // -------------------------------------------------------------------------
  .get("/api/admin/audit", () => ({
    ok: true,
    data: {
      message: "Top secret admin audit log",
      logs: ["Deleted 4 users", "Exported monthly report", "Viewed all private notes"],
    },
  }), { role: "admin" })

  // -------------------------------------------------------------------------
  // GET /api/notes/:id
  // FIX A01: only the owner (or an admin) may read a note. Everyone else gets
  // 404, not 403, so they cannot even learn that the id exists.
  // -------------------------------------------------------------------------
  .get("/api/notes/:id", async ({ params: { id }, user, status }) => {
    if (!UUID_PATTERN.test(id)) return status(404, { ok: false, error: "Note not found" });

    const rows = await sql<{ id: string; title: string; content: string; owner_id: string }[]>`
      select id, title, content, owner_id from notes where id = ${id}
    `;
    const note = rows[0];
    if (!note || (note.owner_id !== user.id && user.role !== "admin")) {
      return status(404, { ok: false, error: "Note not found" });
    }

    return { ok: true, data: note };
  }, { auth: true })

  // -------------------------------------------------------------------------
  // DELETE /api/users/:id
  // FIX A01: authentication and the admin role are required.
  // -------------------------------------------------------------------------
  .delete("/api/users/:id", async ({ params: { id }, user: admin, status }) => {
    if (!UUID_PATTERN.test(id)) return status(400, { ok: false, error: "Invalid user id" });
    if (id === admin.id) return status(400, { ok: false, error: "Admins cannot delete themselves" });

    const result = await sql`delete from users where id = ${id}`;
    if (result.count === 0) return status(404, { ok: false, error: "User not found" });
    return { ok: true, message: `User ${id} deleted` };
  }, { role: "admin" });
