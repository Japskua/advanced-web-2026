/**
 * Authentication and authorization, as an Elysia plugin.
 *
 * Last week this was middleware: withAuth(handler) wrapped a handler in a new
 * function. Elysia has a built-in way to do the same: a *macro*. A macro adds
 * an option to the route definition, and the option runs code before the
 * handler:
 *
 *   .get("/api/notifications", handler, { auth: true })                  any logged-in user
 *   .get("/api/admin/users", handler, { role: "admin" })                  admins only
 *
 * `resolve` returns `{ user }`, which Elysia adds to the handler's context,
 * *typed*: in a route with `auth` or `role`, `user` is an AuthUser, and in
 * a route without them `user` does not exist, so TypeScript stops a handler
 * that forgot its access rule from using it.
 *
 * Failures are thrown as AppErrors; the central error handler turns them into
 * 401 or 403 responses.
 */
import { Elysia } from "elysia";
import type { Role } from "@shared/types";
import { ForbiddenError, UnauthorizedError } from "../errors";
import { findUserById } from "../repositories/user-repository";
import type { AuthUser } from "../types";
import { verifyToken } from "../util/jwt";

function getBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

async function authenticate(authorization: string | undefined): Promise<AuthUser> {
  const token = getBearerToken(authorization);
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

  return { id: user.id, email: user.email, role: user.role };
}

export const auth = new Elysia({ name: "auth" }).macro({
  // { auth: true }: any authenticated user.
  auth: {
    async resolve({ headers }) {
      return { user: await authenticate(headers.authorization) };
    },
  },

  // { role: "admin" }: authenticated, with exactly that role.
  role: (role: Role) => ({
    async resolve({ headers }) {
      const user = await authenticate(headers.authorization);
      if (user.role !== role) {
        // 403: we know who you are, and you are not allowed.
        throw new ForbiddenError(`This requires the ${role} role`);
      }
      return { user };
    },
  }),
});
