// The success envelope. Error responses are built by errors.ts.
import type { ApiResult } from "@shared/types";

export function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}
