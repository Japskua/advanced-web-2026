import { MAX_REQUEST_BYTES, PORT } from "./config";
import { withLogging } from "./middleware/logger";
import { applyMiddleware } from "./middleware/middleware";
import { fallback, routes } from "./router";
import { ensureStorage } from "./services/upload-service";

// Top-level await: ES modules may await at the top level. The folders exist
// before the first request arrives.
await ensureStorage();

const server = Bun.serve({
  port: PORT,
  // Requests with a bigger body are rejected with 413 before reaching our code.
  maxRequestBodySize: MAX_REQUEST_BYTES,
  // Every route handler and the fallback are wrapped with the logger.
  routes: applyMiddleware(routes, withLogging),
  fetch: withLogging(fallback),
});

console.log(`Image Gallery API running at ${server.url}`);
