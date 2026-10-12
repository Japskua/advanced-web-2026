/**
 * JSON Web Tokens (JWT).
 *
 * After a successful login the server gives the client a token. The client
 * sends it with every later request in the Authorization header:
 *
 *   Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIzZjFj….k8Pz…
 *
 * A JWT has three Base64URL-encoded parts separated by dots:
 *   header     {"alg":"HS256"}                         which algorithm signed it
 *   payload    {"sub":"<user id>","email":…,"exp":…}   the "claims"
 *   signature  HMAC-SHA256(header + "." + payload, JWT_SECRET)
 *
 * The payload is only *encoded*, not encrypted: anyone can read it (paste a
 * token into https://jwt.io). Never put secrets in it. What a client cannot do
 * is *change* it, because the signature would no longer match, and producing a
 * new signature requires JWT_SECRET, which only the server knows.
 *
 * The server keeps no record of issued tokens: verifying the signature and the
 * expiry time is enough. That is what "stateless authentication" means.
 *
 * Bun has no JWT functions built in, so we use the `jose` library.
 */
import { jwtVerify, SignJWT } from "jose";
import type { PublicUser } from "@shared/types";
import { JWT_SECRET } from "../config";

const secretKey = new TextEncoder().encode(JWT_SECRET);

export async function signToken(user: PublicUser): Promise<string> {
  return await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" }) // HMAC with SHA-256: one shared secret signs and verifies
    .setSubject(user.id) // "sub": whom the token is about
    .setIssuedAt() // "iat": when it was created
    .setExpirationTime("2h") // "exp": after this, jwtVerify() rejects it
    .sign(secretKey);
}

/**
 * Who sent this request? Returns the authenticated user, or null when the
 * token is missing, malformed, tampered with or expired.
 *
 * Handlers call this first and answer 401 if it returns null. Week 8 turns this
 * into a real middleware (withAuth) so handlers cannot forget the check.
 */
export async function requireAuth(req: Request): Promise<PublicUser | null> {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();

  try {
    // Checks the signature and the expiry. `algorithms` pins the expected
    // algorithm, so a token claiming a different one is rejected.
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
