import type { BunRequest, Server } from "bun";
import { TooManyRequestsError } from "../errors";
import { toUserDto } from "../mappers";
import { loginUser, registerUser, setKeyFingerprint } from "../services/auth-service";
import type { AuthUser } from "../types";
import { clientIp } from "../util/client-ip";
import { RateLimiter } from "../util/rate-limiter";
import { ok } from "../util/response";
import { parseLoginBody, parseOnboardingBody, parseRegisterBody, readJson } from "../util/validation";

// POST /api/auth/register
export async function register(req: Request): Promise<Response> {
  const input = parseRegisterBody(await readJson(req));
  return ok(await registerUser(input), 201);
}

// At most 5 login attempts per IP address and email per 15 minutes (week 11);
// a successful login resets the count.
const loginLimiter = new RateLimiter(5, 15 * 60 * 1000);

// POST /api/auth/login
export async function login(req: BunRequest<"/api/auth/login">, server: Server<undefined>): Promise<Response> {
  const { email, password } = parseLoginBody(await readJson(req));

  // Count the attempt before the slow password check, so a burst of parallel
  // guesses cannot slip past the limit (see util/rate-limiter.ts).
  const key = `${clientIp(req, server)}|${email}`;
  const limit = loginLimiter.consume(key);
  if (!limit.allowed) throw new TooManyRequestsError(limit.retryAfterSeconds);

  const result = await loginUser(email, password); // throws 401 on bad credentials
  loginLimiter.reset(key);
  return ok(result);
}

// GET /api/auth/me
export async function me(_req: Request, user: AuthUser): Promise<Response> {
  return ok(toUserDto(user));
}

// POST /api/auth/onboarding – register the fingerprint of the new key.
export async function onboarding(req: Request, user: AuthUser): Promise<Response> {
  const { keyFingerprint } = parseOnboardingBody(await readJson(req));
  return ok(await setKeyFingerprint(user, keyFingerprint));
}
