/**
 * The application, assembled from plugins. The request travels like this:
 *
 *   Elysia
 *     → cors, logger                        (plugins: every request)
 *       → schema validation                 (body, params: per route, routes.ts)
 *         → auth / roles                    (macro: per route, routes.ts)
 *           → handler                       (HTTP: clean input, respond)
 *             → service                     (business rules)
 *               → repository                (SQL)
 *                 → PostgreSQL
 *
 * Any error thrown on the way down comes back up to errorHandler.
 *
 * `app` is exported without starting a server, so tests can call it directly:
 * `app.handle(new Request(...))` returns the Response. main.ts starts it.
 */
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { errorHandler } from "./errors";
import { logger } from "./plugins/logger";
import { routes } from "./routes";

export const app = new Elysia()
  // CORS headers on every response, and answers to preflight (OPTIONS)
  // requests: last week's corsHeaders() and the OPTIONS case in fallback().
  .use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  )
  .use(logger)
  .use(errorHandler)
  .use(routes);
