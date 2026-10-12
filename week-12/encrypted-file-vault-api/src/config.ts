// Configuration from environment variables: a .env file locally (loaded by
// Bun), Container App settings in Azure. The same code runs in both places.

function required(name: string): string {
  const value = Bun.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env and check its values.`);
  }
  return value;
}

// Azure Container Apps tells the app which port to listen on; 8000 locally.
export const PORT = Number(Bun.env.PORT ?? 8000);

export const DATABASE_URL = required("DATABASE_URL");

export const JWT_SECRET = required("JWT_SECRET");
if (JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters long.");
// The value from .env.example is public (it is on GitHub): never sign with it.
if (JWT_SECRET.startsWith("replace-me")) {
  throw new Error("JWT_SECRET still has the placeholder from .env.example. Run `bun run setup:env` in the repository root, or generate one: bun -e 'console.log(crypto.getRandomValues(new Uint8Array(32)).toBase64())'");
}

export const INVITE_CODE = required("INVITE_CODE");

// Required, with no "*" default: in production this must be the Static Web
// App's exact URL.
export const ALLOWED_ORIGIN = required("ALLOWED_ORIGIN");

// Set to "true" when the API runs behind a reverse proxy that adds the client's
// address to the X-Forwarded-For header (Azure Container Apps' ingress does).
// Leave it off otherwise: then anyone could send that header and pretend to
// be any IP address, for example to dodge the login rate limit.
export const TRUST_PROXY = Bun.env.TRUST_PROXY === "true";

export const AZURE_STORAGE_CONNECTION_STRING = required("AZURE_STORAGE_CONNECTION_STRING");
export const AZURE_STORAGE_CONTAINER_NAME = Bun.env.AZURE_STORAGE_CONTAINER_NAME ?? "encrypted-files";
