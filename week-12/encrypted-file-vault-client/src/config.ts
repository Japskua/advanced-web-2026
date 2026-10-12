/**
 * Where the API is, decided at BUILD time.
 *
 * A static site has no server-side code that could read environment variables
 * when a page is requested. Instead, the bundler writes the value into the
 * JavaScript while building:
 *
 *   BUN_PUBLIC_API_URL=https://vault-api.example.azurecontainerapps.io bun run build
 *
 * turns `process.env.BUN_PUBLIC_API_URL` below into that string literal. In
 * development the value comes from .env (see bunfig.toml).
 *
 * If the variable was not set, the expression is left as it is, and `process`
 * does not exist in browsers. The try/catch turns that into the local default
 * instead of a blank page.
 */
function apiUrlFromBuild(): string | undefined {
  try {
    return process.env.BUN_PUBLIC_API_URL;
  } catch {
    return undefined;
  }
}

export const API_URL = (apiUrlFromBuild() ?? "http://localhost:8000").replace(/\/$/, "");
