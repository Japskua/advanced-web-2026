import { MAX_FILE_BYTES } from "@shared/limits";
import { PORT } from "./config";
import { sql } from "./db/client";
import { errorHandler } from "./errors";
import { withLogging } from "./middleware/logger";
import { applyMiddleware } from "./middleware/middleware";
import { fallback, routes } from "./routes";
import { checkStorage } from "./services/object-storage";

await checkStorage();

const server = Bun.serve({
  port: PORT,
  // The largest legitimate request: a 10 MB file plus the encryption tag and
  // the multipart framing. Bigger bodies are rejected before any code runs.
  maxRequestBodySize: MAX_FILE_BYTES + 1024 * 1024,
  routes: applyMiddleware(routes, withLogging),
  fetch: withLogging(fallback),
  error: errorHandler,
});

console.log(`Encrypted File Vault API running at ${server.url}`);

// Docker stops containers with SIGTERM (`docker compose down`, a redeploy).
// Finish the requests in flight and close the database pool before exiting.
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down…");
  await server.stop();
  await sql.close();
  process.exit(0);
});
