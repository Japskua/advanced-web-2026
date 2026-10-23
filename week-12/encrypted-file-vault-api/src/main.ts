// Entry point: check the object storage, then start the app from app.ts on PORT.
import { MAX_FILE_BYTES } from "@shared/limits";
import { app } from "./app";
import { PORT } from "./config";
import { sql } from "./db/client";
import { checkStorage } from "./services/object-storage";

await checkStorage();

app.listen({
  port: PORT,
  // The largest legitimate request: a 10 MB file plus the encryption tag and
  // the multipart framing. Bigger bodies are rejected before any code runs.
  maxRequestBodySize: MAX_FILE_BYTES + 1024 * 1024,
});

console.log(`Encrypted File Vault API running at ${app.server?.url}`);

// Docker stops containers with SIGTERM (`docker compose down`, a redeploy).
// Finish the requests in flight and close the database pool before exiting.
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down…");
  await app.stop();
  await sql.close();
  process.exit(0);
});
