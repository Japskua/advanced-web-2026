/**
 * Response helpers, now in their own module because several files use them.
 * Every JSON response carries the CORS headers and the ApiResult envelope.
 */
import type { ApiResult } from "@shared/types";

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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
