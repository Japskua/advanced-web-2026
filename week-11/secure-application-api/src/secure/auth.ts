/**
 * Authentication for the secure version (FIX for A04 and A07).
 *
 * - Tokens are signed JWTs (HS256). Editing the payload breaks the signature.
 * - The user is loaded from the database on every request, so the role used for
 *   authorisation is the *current* one, and deleted users lose access at once.
 */
import { jwtVerify, SignJWT } from "jose";
import { JWT_SECRET } from "../config";
import { secureSql as sql } from "../db";

export interface AuthUser {
  id: string;
  email: string;
  role: "user" | "admin";
}

const secretKey = new TextEncoder().encode(JWT_SECRET);

export async function signToken(userId: string): Promise<string> {
  return await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secretKey);
}

// The authenticated user, or null for a missing, forged or expired token.
export async function authenticate(req: Request): Promise<AuthUser | null> {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;

  let userId: string;
  try {
    const { payload } = await jwtVerify(header.slice(7), secretKey, { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    userId = payload.sub;
  } catch {
    return null;
  }

  const rows = await sql<AuthUser[]>`select id, email, role from users where id = ${userId}`;
  return rows[0] ?? null;
}
