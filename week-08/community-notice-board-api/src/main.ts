/**
 * Entry point. The request travels through the layers like this:
 *
 *   Bun.serve
 *     → withLogging                         (middleware: every request)
 *       → withAuth / withAdmin              (middleware: per route, routes.ts)
 *         → handler                         (HTTP: parse, validate, respond)
 *           → service                       (business rules)
 *             → repository                  (SQL)
 *               → PostgreSQL
 *
 * Any AppError thrown on the way down comes back up to errorHandler.
 */
import { PORT } from "./config";
import { errorHandler } from "./errors";
import { withLogging } from "./middleware/logger";
import { applyMiddleware } from "./middleware/middleware";
import { fallback, routes } from "./routes";

const server = Bun.serve({
  port: PORT,
  routes: applyMiddleware(routes, withLogging),
  fetch: withLogging(fallback),
  error: errorHandler,
});

console.log(`Community Notice Board API running at ${server.url}`);
