import type { ApiResult } from "@shared/types";
import { FRONTEND_URL } from "../config";

/**
 * CORS for requests *with cookies*.
 *
 * The client sends requests with `credentials: "include"` so the browser
 * attaches the session cookie. For such requests the browser demands:
 * - Access-Control-Allow-Origin is the exact origin, never "*";
 * - Access-Control-Allow-Credentials is "true".
 * Otherwise it hides the response from the page.
 *
 * `Vary: Origin` tells caches that the response depends on the Origin header.
 */
export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": FRONTEND_URL,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export function ok<T>(data: T, status = 200): Response {
  const body: ApiResult<T> = { ok: true, data };
  return Response.json(body, { status, headers: corsHeaders() });
}

export function fail(message: string, status: number): Response {
  const body: ApiResult<never> = { ok: false, error: { message } };
  return Response.json(body, { status, headers: corsHeaders() });
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// A 302 redirect. The OAuth flow is a chain of browser redirects.
export function redirect(location: string | URL): Response {
  return new Response(null, { status: 302, headers: { Location: String(location) } });
}
