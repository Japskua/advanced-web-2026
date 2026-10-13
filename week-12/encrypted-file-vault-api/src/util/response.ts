import type { ApiResult } from "@shared/types";
import { ALLOWED_ORIGIN } from "../config";

// CORS for one origin: the client's. In development the client runs on another
// port (5173) than the API (8000). In production Caddy serves both from the
// same origin, so CORS is not even needed there, but it does no harm.
export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600", // browsers may cache a preflight answer for 10 minutes
    Vary: "Origin",
  };
}

export function ok<T>(data: T, status = 200): Response {
  const body: ApiResult<T> = { ok: true, data };
  return Response.json(body, { status, headers: corsHeaders() });
}

export function fail(message: string, status: number, headers: Record<string, string> = {}): Response {
  const body: ApiResult<never> = { ok: false, error: { message } };
  return Response.json(body, { status, headers: { ...corsHeaders(), ...headers } });
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export function bytes(data: Uint8Array, contentType = "application/octet-stream"): Response {
  return new Response(data, {
    headers: { ...corsHeaders(), "Content-Type": contentType, "Cache-Control": "no-store" },
  });
}
