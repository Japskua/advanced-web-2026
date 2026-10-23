/**
 * Request logging, as an Elysia plugin.
 *
 *   [2026-10-12T08:30:00.000Z] → GET /api/me
 *   [2026-10-12T08:30:00.003Z] ← 200 GET /api/me (2.6 ms)
 *
 * Before Elysia (week 8) this was withLogging(handler) plus applyMiddleware() to wrap
 * every route. Elysia has *lifecycle hooks* instead: onRequest runs when a
 * request arrives, onAfterResponse when the response has been sent (also when
 * a handler threw and the error handler answered). `derive` stores the start
 * time in the request's context.
 */
import { Elysia } from "elysia";

export const logger = new Elysia({ name: "logger" })
  .derive({ as: "global" }, () => ({ startedAt: performance.now() }))
  .onRequest(({ request }) => {
    console.log(`[${new Date().toISOString()}] → ${request.method} ${new URL(request.url).pathname}`);
  })
  .onAfterResponse({ as: "global" }, ({ request, set, responseValue, startedAt }) => {
    const ms = (performance.now() - (startedAt ?? performance.now())).toFixed(1);
    // A handler that returns a Response (a redirect) sets its status there.
    const code = responseValue instanceof Response ? responseValue.status : set.status;
    console.log(`[${new Date().toISOString()}] ← ${code} ${request.method} ${new URL(request.url).pathname} (${ms} ms)`);
  });
