// All configuration comes from environment variables (.env is loaded by Bun).

function required(name: string): string {
  const value = Bun.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env and check its values.`);
  }
  return value;
}

export const PORT = Number(Bun.env.PORT ?? 8000);
export const DATABASE_URL = required("DATABASE_URL");

// No fallback value. Last year's code used `JWT_SECRET ?? "dev-secret"`: forget
// the variable in production and every token is signed with a secret that is
// published on GitHub.
export const JWT_SECRET = required("JWT_SECRET");
if (JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long.");
}
// The value from .env.example is public (it is on GitHub): never sign with it.
if (JWT_SECRET.startsWith("replace-me")) {
  throw new Error("JWT_SECRET still has the placeholder from .env.example. Run `bun run setup:env` in the repository root, or generate one: bun -e 'console.log(crypto.getRandomValues(new Uint8Array(32)).toBase64())'");
}

export const TOKEN_LIFETIME = "1h";
