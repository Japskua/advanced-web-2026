import { OIDC_ISSUER, PORT } from "./config";
import { withLogging } from "./middleware/logger";
import { applyMiddleware } from "./middleware/middleware";
import { errorHandler, fallback, routes } from "./routes";

const server = Bun.serve({
  port: PORT,
  routes: applyMiddleware(routes, withLogging),
  fetch: withLogging(fallback),
  error: errorHandler,
});

console.log(`Profile Viewer API running at ${server.url} (identity provider: ${OIDC_ISSUER})`);
