// Signing and verifying JWTs (as in week 8).
import { jwtVerify, SignJWT } from "jose";
import { JWT_SECRET } from "../config";

const secretKey = new TextEncoder().encode(JWT_SECRET);

export async function signToken(userId: string): Promise<string> {
  return await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secretKey);
}

// Returns the user id; throws for an invalid or expired token.
export async function verifyToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
  if (typeof payload.sub !== "string") throw new Error("Token has no subject");
  return payload.sub;
}
