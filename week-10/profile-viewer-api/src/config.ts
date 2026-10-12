// Configuration from environment variables (.env is loaded by Bun).

function required(name: string): string {
  const value = Bun.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env and check its values.`);
  }
  return value;
}

export const PORT = Number(Bun.env.PORT ?? 8000);
export const BASE_URL = required("BASE_URL");
export const FRONTEND_URL = required("FRONTEND_URL");

// The OpenID Connect provider. Google by default; the mock provider in dev/ or
// any other standards-compliant provider works with the same code.
export const OIDC_ISSUER = Bun.env.OIDC_ISSUER ?? "https://accounts.google.com";
export const CLIENT_ID = required("GOOGLE_CLIENT_ID");
export const CLIENT_SECRET = required("GOOGLE_CLIENT_SECRET");

// Must match an "Authorized redirect URI" in Google Cloud Console exactly.
export const REDIRECT_URI = `${BASE_URL}/auth/google/callback`;

// Cookies get the Secure flag (HTTPS only) whenever the API is served over
// HTTPS. Browsers treat http://localhost as a secure context, but plain HTTP
// on any other host would not accept Secure cookies.
export const COOKIE_SECURE = BASE_URL.startsWith("https://");

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // a session lasts 8 hours
export const LOGIN_TTL_MS = 10 * 60 * 1000; // a started login must finish within 10 minutes
