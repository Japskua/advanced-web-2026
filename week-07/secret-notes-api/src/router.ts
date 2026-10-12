import { requireAuth } from "./middleware/auth-middleware";
import { listNotes } from "./repositories/notes-repository";
import { EmailTakenError } from "./repositories/user-repository";
import { InvalidCredentialsError, login, register } from "./services/auth-service";
import { corsHeaders, fail, ok } from "./util/response";
import { MIN_PASSWORD_LENGTH, parseLoginBody, parseRegisterBody, readJson } from "./util/validation";

// POST /api/auth/register
async function registerHandler(req: Request): Promise<Response> {
  const credentials = parseRegisterBody(await readJson(req));
  if (!credentials) {
    return fail(`Provide a valid email and a password of at least ${MIN_PASSWORD_LENGTH} characters.`, 400);
  }

  try {
    const user = await register(credentials.email, credentials.password);
    return ok(user, 201);
  } catch (error) {
    if (error instanceof EmailTakenError) return fail(error.message, 409);
    throw error;
  }
}

// POST /api/auth/login
async function loginHandler(req: Request): Promise<Response> {
  const credentials = parseLoginBody(await readJson(req));
  if (!credentials) {
    return fail("Invalid email or password", 401);
  }

  try {
    return ok(await login(credentials.email, credentials.password));
  } catch (error) {
    if (error instanceof InvalidCredentialsError) return fail(error.message, 401);
    throw error;
  }
}

// GET /api/notes – only for authenticated users.
async function listNotesHandler(req: Request): Promise<Response> {
  const user = await requireAuth(req);
  if (!user) {
    // 401 Unauthorized really means "unauthenticated": we do not know who you
    // are. (403 Forbidden, used in week 8, means: we know, and you may not.)
    return fail("Not authenticated", 401);
  }

  return ok(await listNotes());
}

export const routes = {
  "/api/auth/register": { POST: registerHandler },
  "/api/auth/login": { POST: loginHandler },
  "/api/notes": { GET: listNotesHandler },
};

export function fallback(req: Request): Response {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  return fail("Not found", 404);
}

export function errorHandler(error: Error): Response {
  console.error("Unhandled error:", error);
  return fail("Internal server error", 500);
}
