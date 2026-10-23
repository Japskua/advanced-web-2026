/**
 * Authentication, as an Elysia macro (week 8): a route with `{ auth: true }`
 * is only reached by authenticated users, and its handler gets `user`, typed.
 *
 *   .get("/files", ({ user }) => ..., { auth: true })
 *
 * Why a Bearer token and not week 10's session cookie? A token works wherever
 * the client runs: on another port in development, on another domain, in a
 * mobile app. Our production setup serves the client and the API from the same
 * origin (Caddy routes /api to the API), so an HttpOnly session cookie would
 * work there too: that is one of this week's exercises.
 */
import { Elysia } from "elysia";
import { UnauthorizedError } from "../errors";
import { findUserById } from "../repositories/user-repository";
import type { AuthUser } from "../types";
import { verifyToken } from "../util/jwt";

async function authenticate(authorization: string | undefined): Promise<AuthUser> {
  if (!authorization?.startsWith("Bearer ")) throw new UnauthorizedError("Missing authentication token");

  let userId: string;
  try {
    userId = await verifyToken(authorization.slice("Bearer ".length).trim());
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }

  const user = await findUserById(userId);
  if (!user) throw new UnauthorizedError("Account no longer exists");

  return { id: user.id, email: user.email, keyFingerprint: user.keyFingerprint };
}

export const auth = new Elysia({ name: "auth" }).macro({
  auth: {
    async resolve({ headers }) {
      return { user: await authenticate(headers.authorization) };
    },
  },
});
