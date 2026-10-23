/**
 * Request logging, as an Elysia plugin.
 *
 *   [2026-10-12T08:30:00.000Z] → POST /api/admin/notifications
 *   [2026-10-12T08:30:00.021Z] ← 201 POST /api/admin/notifications (21.4 ms)
 *
 * Last week this was withLogging(handler) plus applyMiddleware() to wrap
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
  .onAfterResponse({ as: "global" }, ({ request, set, startedAt }) => {
    const ms = (performance.now() - (startedAt ?? performance.now())).toFixed(1);
    console.log(`[${new Date().toISOString()}] ← ${set.status} ${request.method} ${new URL(request.url).pathname} (${ms} ms)`);
  });
