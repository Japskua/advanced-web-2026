/**
 * The application, assembled from plugins, as in week 8:
 *
 *   Elysia
 *     → cors, logger              (plugins: every request)
 *       → route                   (routes.ts: the OAuth flow and the session)
 *         → services              (login-service: OIDC, session-service: sessions)
 *
 * Anything a handler throws comes back to errorHandler (errors.ts).
 *
 * `app` is exported without starting a server, so tests can serve it on any
 * port: `Bun.serve({ port, fetch: (req) => app.handle(req) })`. main.ts starts it.
 */
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { FRONTEND_URL } from "./config";
import { errorHandler } from "./errors";
import { logger } from "./plugins/logger";
import { routes } from "./routes";

export const app = new Elysia()
  // CORS for requests *with cookies*. The client sends requests with
  // `credentials: "include"` so the browser attaches the session cookie. For
  // such requests the browser demands:
  // - Access-Control-Allow-Origin is the exact origin, never "*";
  // - Access-Control-Allow-Credentials is "true".
  // Otherwise it hides the response from the page. The plugin also answers
  // preflight (OPTIONS) requests and adds `Vary: Origin`.
  .use(
    cors({
      origin: FRONTEND_URL,
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
      exposeHeaders: [],
    }),
  )
  .use(logger)
  .use(errorHandler)
  .use(routes);
