import type { Server } from "bun";
import { TRUST_PROXY } from "../config";

/**
 * The client's IP address, for rate limiting.
 *
 * Locally, the TCP connection comes straight from the browser, and
 * server.requestIP() is the client. In Azure, every connection comes from the
 * Container Apps ingress (a reverse proxy), so requestIP() would be the same
 * proxy address for everybody, and the limiter would effectively key on the
 * email alone. The proxy appends the real client address to X-Forwarded-For;
 * the *last* entry is the one it added (earlier entries come from the client
 * and can be faked).
 */
export function clientIp(req: Request, server: Server<undefined>): string {
  if (TRUST_PROXY) {
    const forwarded = req.headers.get("X-Forwarded-For")?.split(",").at(-1)?.trim();
    if (forwarded) return forwarded;
  }
  return server.requestIP(req)?.address ?? "unknown";
}
