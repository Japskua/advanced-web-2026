/**
 * Request logging middleware.
 *
 *   [2026-10-12T08:30:00.000Z] → POST /api/uploads
 *   [2026-10-12T08:30:00.021Z] ← 201 POST /api/uploads (21.4 ms)
 *
 * The "before" part runs when the request arrives, the "after" part when the
 * wrapped handler has produced its response.
 */
import type { Middleware } from "./middleware";

export const withLogging: Middleware = (next) => async (req, server) => {
  const start = performance.now();
  const { pathname } = new URL(req.url);

  // Docker's health check calls /api/health every 15 seconds (see the
  // Dockerfile); logging those would bury the real requests.
  if (pathname === "/api/health") return next(req, server);

  console.log(`[${new Date().toISOString()}] → ${req.method} ${pathname}`);

  try {
    const res = await next(req, server);
    const ms = (performance.now() - start).toFixed(1);
    console.log(`[${new Date().toISOString()}] ← ${res.status} ${req.method} ${pathname} (${ms} ms)`);
    return res;
  } catch (error) {
    // One line here; the error itself continues to Bun's error handler, which
    // chooses the response (and logs unexpected errors in full).
    const ms = (performance.now() - start).toFixed(1);
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.log(`[${new Date().toISOString()}] ← threw ${reason} | ${req.method} ${pathname} (${ms} ms)`);
    throw error;
  }
};
