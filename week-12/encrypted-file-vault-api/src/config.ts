// Configuration from environment variables: a .env file locally (loaded by
// Bun), the server's .env file read by Docker Compose in production. The same
// code runs in both places.

function required(name: string): string {
  const value = Bun.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env and check its values.`);
  }
  return value;
}

export const PORT = Number(Bun.env.PORT ?? 8000);

export const DATABASE_URL = required("DATABASE_URL");

export const JWT_SECRET = required("JWT_SECRET");
if (JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters long.");
// The value from .env.example is public (it is on GitHub): never sign with it.
if (JWT_SECRET.startsWith("replace-me")) {
  throw new Error("JWT_SECRET still has the placeholder from .env.example. Run `bun run setup:env` in the repository root, or generate one: bun -e 'console.log(crypto.getRandomValues(new Uint8Array(32)).toBase64())'");
}

export const INVITE_CODE = required("INVITE_CODE");

// Required, with no "*" default: in production this is the site's own URL.
export const ALLOWED_ORIGIN = required("ALLOWED_ORIGIN");

// Set to "true" when the API runs behind a reverse proxy that adds the client's
// address to the X-Forwarded-For header (Caddy, in our deployment).
// Leave it off otherwise: then anyone could send that header and pretend to
// be any IP address, for example to dodge the login rate limit.
export const TRUST_PROXY = Bun.env.TRUST_PROXY === "true";

// S3-compatible object storage (see services/object-storage.ts). The names are
// the ones Bun's S3 client also reads by itself.
export const S3_ENDPOINT = required("S3_ENDPOINT");
export const S3_BUCKET = required("S3_BUCKET");
export const S3_ACCESS_KEY_ID = required("S3_ACCESS_KEY_ID");
export const S3_SECRET_ACCESS_KEY = required("S3_SECRET_ACCESS_KEY");
export const S3_REGION = Bun.env.S3_REGION ?? "us-east-1";
export const S3_VIRTUAL_HOSTED_STYLE = Bun.env.S3_VIRTUAL_HOSTED_STYLE === "true";
