/**
 * Starts the vulnerable or the secure version:
 *
 *   bun run dev:vulnerable   → http://localhost:8000
 *   bun run dev:secure       → http://localhost:8001
 *
 * Both can run at the same time, against separate databases.
 */
import { PORTS, readMode } from "./config";

const mode = readMode();
const port = PORTS[mode];

// A dynamic import loads only the chosen version's code.
async function start() {
  if (mode === "secure") {
    const app = await import("./secure/routes");
    return Bun.serve({ port, routes: app.routes, fetch: app.fallback, error: app.errorHandler });
  }
  const app = await import("./vulnerable/routes");
  return Bun.serve({ port, routes: app.routes, fetch: app.fallback, error: app.errorHandler });
}

const server = await start();

const banner = mode === "secure" ? "✅ SECURE version" : "⚠️  VULNERABLE version (for demonstration only)";
console.log(`${banner} running at ${server.url}`);
