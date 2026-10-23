/**
 * The application, assembled from plugins (week 8). The request travels like
 * this:
 *
 *   Elysia
 *     → cors, logger                        (plugins: every request)
 *       → auth                              (macro: per route, routes.ts)
 *         → handler                         (HTTP: validate input, respond)
 *           → service                       (business rules)
 *             → repository / object storage (SQL, S3)
 *
 * Any error thrown on the way down comes back up to errorHandler.
 *
 * `app` is exported without starting a server, so tests can start it on any
 * port. main.ts starts it on PORT.
 */
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { ALLOWED_ORIGIN } from "./config";
import { errorHandler } from "./errors";
import { logger } from "./plugins/logger";
import { routes } from "./routes";

export const app = new Elysia()
  // CORS for one origin: the client's. In development the client runs on
  // another port (5173) than the API (8000). In production Caddy serves both
  // from the same origin, so CORS is not even needed there, but it does no harm.
  .use(
    cors({
      origin: ALLOWED_ORIGIN,
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: false, // Bearer tokens, no cookies
      exposeHeaders: [],
      maxAge: 600, // browsers may cache a preflight answer for 10 minutes
    }),
  )
  .use(logger)
  .use(errorHandler)
  .use(routes);
