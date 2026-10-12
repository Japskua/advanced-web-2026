import { MAX_FILE_BYTES } from "@shared/limits";
import { PORT } from "./config";
import { sql } from "./db/client";
import { errorHandler } from "./errors";
import { withLogging } from "./middleware/logger";
import { applyMiddleware } from "./middleware/middleware";
import { fallback, routes } from "./routes";
import { ensureContainer } from "./services/blob-storage";

await ensureContainer();

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

// Containers are stopped with SIGTERM (a new revision, scaling in). Finish the
// requests in flight and close the database pool before exiting.
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down…");
  await server.stop();
  await sql.close();
  process.exit(0);
});
