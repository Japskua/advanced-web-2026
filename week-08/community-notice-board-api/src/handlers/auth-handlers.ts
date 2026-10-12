/**
 * Handlers (sometimes called controllers) are the HTTP layer:
 *   1. read and validate the request
 *   2. call a service
 *   3. turn the result into a response
 * No business rules and no SQL. Errors are thrown, not returned.
 */
import type { AuthUser } from "../types";
import { loginUser, registerUser } from "../services/auth-service";
import { getCurrentUser } from "../services/user-service";
import { ok } from "../util/response";
import { parseLoginBody, parseRegisterBody, readJson } from "../util/validation";

// POST /api/auth/register
export async function register(req: Request): Promise<Response> {
  const { email, password } = parseRegisterBody(await readJson(req));
  return ok(await registerUser(email, password), 201);
}

// POST /api/auth/login
export async function login(req: Request): Promise<Response> {
  const { email, password } = parseLoginBody(await readJson(req));
  return ok(await loginUser(email, password));
}

// GET /api/auth/me – who am I? (wrapped with withAuth in routes.ts)
export async function me(_req: Request, user: AuthUser): Promise<Response> {
  return ok(await getCurrentUser(user.id));
}
