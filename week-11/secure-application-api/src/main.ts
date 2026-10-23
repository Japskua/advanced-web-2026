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

// A dynamic import loads only the chosen version's code.
const { app } = mode === "secure" ? await import("./secure/app") : await import("./vulnerable/app");
app.listen(PORTS[mode]);

const banner = mode === "secure" ? "✅ SECURE version" : "⚠️  VULNERABLE version (for demonstration only)";
console.log(`${banner} running at ${app.server?.url}`);
