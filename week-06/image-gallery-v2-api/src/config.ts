/**
 * Configuration, read from environment variables.
 *
 * Bun loads the project's .env file into the environment automatically before
 * the program starts (no flags, no packages). Values are read through Bun.env
 * (the same object as Node's process.env).
 *
 * Configuration that differs between environments (your laptop, the test
 * server, production) belongs in environment variables, not in the code. Above
 * all: passwords such as the one inside DATABASE_URL must never be committed.
 */
import path from "node:path";

const PROJECT_ROOT = path.resolve(import.meta.dir, "..");

function required(name: string): string {
  const value = Bun.env[name];
  if (!value) {
    // Fail at startup with a clear message, instead of at the first request
    // with a confusing one.
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env and check its values.`);
  }
  return value;
}

export const PORT = Number(Bun.env.PORT ?? 8000);
export const DATABASE_URL = required("DATABASE_URL");
export const UPLOADS_DIR = Bun.env.UPLOADS_DIR ?? path.join(PROJECT_ROOT, "uploads");
export const MAX_REQUEST_BYTES = 6 * 1024 * 1024;
