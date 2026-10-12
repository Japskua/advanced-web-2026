import { PORT } from "./config";
import { withLogging } from "./middleware/logger";
import { applyMiddleware } from "./middleware/middleware";
import { errorHandler, fallback, routes } from "./router";

const server = Bun.serve({
  port: PORT,
  routes: applyMiddleware(routes, withLogging),
  fetch: withLogging(fallback),
  error: errorHandler,
});

console.log(`Secret Notes API running at ${server.url}`);
