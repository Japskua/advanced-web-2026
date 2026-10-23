// The JSON envelopes. CORS headers come from the cors plugin (app.ts).
import type { ApiResult } from "@shared/types";

export function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

export function fail(message: string): ApiResult<never> {
  return { ok: false, error: { message } };
}
