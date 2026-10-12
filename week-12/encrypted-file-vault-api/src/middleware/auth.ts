/**
 * withAuth(handler): only authenticated users reach the handler (week 8).
 *
 * Why a Bearer token and not week 10's session cookie? In Azure, the client
 * (…azurestaticapps.net) and the API (…azurecontainerapps.io) are on different
 * *sites*. A cookie would have to be SameSite=None to be sent at all, and
 * browsers increasingly block such third-party cookies. A token in the
 * Authorization header works across sites. (Serving both from one domain, e.g.
 * app.example.com and api.example.com, would make cookies an option again.)
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
