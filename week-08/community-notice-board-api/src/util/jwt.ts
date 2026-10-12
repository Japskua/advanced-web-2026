/**
 * Creating and checking JWTs, separated from the middleware.
 *
 * Last week the middleware file also signed tokens. Now that tokens are signed
 * in the auth service and verified in the middleware, the token code gets its
 * own module, and the middleware only decides whether a request may continue.
 */
import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@shared/types";
import { JWT_SECRET, TOKEN_LIFETIME } from "../config";

const secretKey = new TextEncoder().encode(JWT_SECRET);

export async function signToken(user: { id: string; email: string; role: Role }): Promise<string> {
  return await new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(TOKEN_LIFETIME)
    .sign(secretKey);
}

// Returns the user id from a valid token; throws if the token is invalid or expired.
export async function verifyToken(token: string): Promise<{ userId: string }> {
  const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
  if (typeof payload.sub !== "string") throw new Error("Token has no subject");
  return { userId: payload.sub };
}
