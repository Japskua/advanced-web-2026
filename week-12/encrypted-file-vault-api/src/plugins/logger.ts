/**
 * Request logging, as an Elysia plugin (week 8).
 *
 *   [2026-10-12T08:30:00.000Z] → POST /api/files
 *   [2026-10-12T08:30:00.021Z] ← 201 POST /api/files (21.4 ms)
 *
 * onRequest runs when a request arrives, onAfterResponse when the response has
 * been sent (also when a handler threw and the error handler answered).
 * `derive` stores the start time in the request's context.
 */
import { Elysia } from "elysia";

// Docker's health check calls /api/health every 15 seconds (see the
// Dockerfile); logging those would bury the real requests.
function isHealthCheck(request: Request): boolean {
  return new URL(request.url).pathname === "/api/health";
}

export const logger = new Elysia({ name: "logger" })
  .derive({ as: "global" }, () => ({ startedAt: performance.now() }))
  .onRequest(({ request }) => {
    if (isHealthCheck(request)) return;
    console.log(`[${new Date().toISOString()}] → ${request.method} ${new URL(request.url).pathname}`);
  })
  .onAfterResponse({ as: "global" }, ({ request, set, responseValue, startedAt }) => {
    if (isHealthCheck(request)) return;
    const ms = (performance.now() - (startedAt ?? performance.now())).toFixed(1);
    // A handler that returns a Response sets its status there.
    const code = responseValue instanceof Response ? responseValue.status : set.status;
    console.log(`[${new Date().toISOString()}] ← ${code} ${request.method} ${new URL(request.url).pathname} (${ms} ms)`);
  });
