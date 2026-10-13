/**
 * withAuth(handler): only authenticated users reach the handler (week 8).
 *
 * Why a Bearer token and not week 10's session cookie? A token works wherever
 * the client runs: on another port in development, on another domain, in a
 * mobile app. Our production setup serves the client and the API from the same
 * origin (Caddy routes /api to the API), so an HttpOnly session cookie would
 * work there too: that is one of this week's exercises.
 */
import type { BunRequest } from "bun";
import { UnauthorizedError } from "../errors";
import { findUserById } from "../repositories/user-repository";
import type { AuthUser } from "../types";
import { verifyToken } from "../util/jwt";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any route path
export type AuthedHandler<Req extends BunRequest<any>> = (req: Req, user: AuthUser) => Promise<Response>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any route path
export function withAuth<Req extends BunRequest<any>>(handler: AuthedHandler<Req>) {
  return async (req: Req): Promise<Response> => {
    const header = req.headers.get("Authorization");
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedError("Missing authentication token");

    let userId: string;
    try {
      userId = await verifyToken(header.slice("Bearer ".length).trim());
    } catch {
      throw new UnauthorizedError("Invalid or expired token");
    }

    const user = await findUserById(userId);
    if (!user) throw new UnauthorizedError("Account no longer exists");

    return handler(req, { id: user.id, email: user.email, keyFingerprint: user.keyFingerprint });
  };
}
