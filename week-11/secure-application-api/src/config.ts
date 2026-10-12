/**
 * Configuration for both versions of the app.
 *
 *   bun src/main.ts --mode=vulnerable    → port 8000, database secure_app_vulnerable
 *   bun src/main.ts --mode=secure        → port 8001, database secure_app_secure
 *
 * The mode can also come from the SECURITY_MODE environment variable.
 */
import { parseArgs } from "node:util";

export type SecurityMode = "vulnerable" | "secure";

function required(name: string): string {
  const value = Bun.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env and check its values.`);
  }
  return value;
}

export function readMode(): SecurityMode {
  const { values } = parseArgs({ args: Bun.argv.slice(2), options: { mode: { type: "string" } }, strict: false });
  const mode = values.mode ?? Bun.env.SECURITY_MODE ?? "vulnerable";
  if (mode !== "vulnerable" && mode !== "secure") {
    throw new Error(`Unknown mode "${String(mode)}". Use --mode=vulnerable or --mode=secure.`);
  }
  return mode;
}

export const PORTS: Record<SecurityMode, number> = { vulnerable: 8000, secure: 8001 };

export const VULNERABLE_DATABASE_URL = required("VULNERABLE_DATABASE_URL");
export const SECURE_DATABASE_URL = required("SECURE_DATABASE_URL");

export const JWT_SECRET = required("JWT_SECRET");
if (JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters long.");
// The value from .env.example is public (it is on GitHub): never sign with it.
if (JWT_SECRET.startsWith("replace-me")) {
  throw new Error("JWT_SECRET still has the placeholder from .env.example. Run `bun run setup:env` in the repository root, or generate one: bun -e 'console.log(crypto.getRandomValues(new Uint8Array(32)).toBase64())'");
}

export const ALLOWED_ORIGIN = Bun.env.ALLOWED_ORIGIN ?? "http://localhost:5173";
