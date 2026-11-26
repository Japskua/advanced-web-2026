import { MAX_REQUEST_BYTES, PORT } from "./config";
import { withLogging } from "./middleware/logger";
import { applyMiddleware } from "./middleware/middleware";
import { websocket } from "./realtime";
import { errorHandler, fallback, routes } from "./router";
import { ensureStorage } from "./services/upload-service";

await ensureStorage();

// The same server as in week 5. New this week: `error`.
const server = Bun.serve({
  port: PORT,
  maxRequestBodySize: MAX_REQUEST_BYTES,
  routes: applyMiddleware(routes, withLogging),
  fetch: withLogging(fallback),
  // The live viewer count from week 5 (GET /ws, see realtime.ts).
  websocket,
  // If any handler throws, Bun calls `error` instead of crashing the request.
  // Without it, Bun would answer with its own (HTML) error page.
  error: errorHandler,
});

console.log(`Image Gallery v2 API running at ${server.url}`);
