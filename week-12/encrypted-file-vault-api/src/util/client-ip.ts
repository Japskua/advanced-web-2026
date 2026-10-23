import type { Server } from "bun";
import { TRUST_PROXY } from "../config";

/**
 * The client's IP address, for rate limiting.
 *
 * Locally, the TCP connection comes straight from the browser, and
 * server.requestIP() is the client. In production every connection comes from
 * Caddy (the reverse proxy in front of the API), so requestIP() would be the
 * same proxy address for everybody, and the limiter would effectively key on
 * the email alone. Caddy appends the real client address to X-Forwarded-For;
 * the *last* entry is the one it added (earlier entries come from the client
 * and can be faked).
 *
 * `server` is Elysia's context value: the running Bun server, or null when a
 * test calls app.handle() directly without one.
 */
export function clientIp(request: Request, server: Server<unknown> | null): string {
  if (TRUST_PROXY) {
    const forwarded = request.headers.get("X-Forwarded-For")?.split(",").at(-1)?.trim();
    if (forwarded) return forwarded;
  }
  return server?.requestIP(request)?.address ?? "unknown";
}
