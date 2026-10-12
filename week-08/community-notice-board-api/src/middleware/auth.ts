/**
 * Authentication and authorization middleware.
 *
 *   withAuth(handler)          only authenticated users reach the handler
 *   withRole("admin", handler) only users with that role reach the handler
 *   withAdmin(handler)         shorthand for withRole("admin", handler)
 *
 * The wrapped handler receives the authenticated user as a second argument, so
 * it can never run without one. Protection is visible where the route is
 * defined (routes.ts) instead of being a call each handler must remember.
 *
 * Failures are thrown as AppErrors; the central error handler turns them into
 * 401 or 403 responses.
 */
import type { BunRequest } from "bun";
import type { Role } from "@shared/types";
import { ForbiddenError, UnauthorizedError } from "../errors";
import { findUserById } from "../repositories/user-repository";
import type { AuthUser } from "../types";
import { verifyToken } from "../util/jwt";

// A handler that also receives the authenticated user. `Req` keeps the typed
// route parameters (e.g. BunRequest<"/api/admin/users/:id">) intact.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any route path
export type AuthedHandler<Req extends BunRequest<any>> = (req: Req, user: AuthUser) => Promise<Response>;

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any route path
export function withAuth<Req extends BunRequest<any>>(handler: AuthedHandler<Req>) {
  return async (req: Req): Promise<Response> => {
    const token = getBearerToken(req);
    if (!token) throw new UnauthorizedError("Missing authentication token");

    let userId: string;
    try {
      ({ userId } = await verifyToken(token));
    } catch {
      throw new UnauthorizedError("Invalid or expired token");
    }

    // The token proves who the user *was* when they logged in. Looking the user
    // up again makes sure the account still exists and uses their *current*
    // role: a deleted user or a demoted admin loses access immediately, not
    // when the token expires. The price is one database query per request.
    const user = await findUserById(userId);
    if (!user) throw new UnauthorizedError("Account no longer exists");

    return handler(req, { id: user.id, email: user.email, role: user.role });
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any route path
export function withRole<Req extends BunRequest<any>>(role: Role, handler: AuthedHandler<Req>) {
  return withAuth<Req>(async (req, user) => {
    if (user.role !== role) {
      // 403: we know who you are, and you are not allowed.
      throw new ForbiddenError(`This requires the ${role} role`);
    }
    return handler(req, user);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any route path
export function withAdmin<Req extends BunRequest<any>>(handler: AuthedHandler<Req>) {
  return withRole<Req>("admin", handler);
}
