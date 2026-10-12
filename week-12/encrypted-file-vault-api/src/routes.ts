import * as authHandlers from "./handlers/auth-handlers";
import * as fileHandlers from "./handlers/file-handlers";
import { withAuth } from "./middleware/auth";
import { fail, noContent, ok } from "./util/response";

export const routes = {
  // Health check: Azure Container Apps (and load balancers in general) call
  // this to decide whether the container is alive and may receive traffic.
  "/api/health": { GET: () => ok({ status: "up" }) },

  "/api/auth/register": { POST: authHandlers.register },
  "/api/auth/login": { POST: authHandlers.login },
  "/api/auth/me": { GET: withAuth(authHandlers.me) },
  "/api/auth/onboarding": { POST: withAuth(authHandlers.onboarding) },

  "/api/files": { GET: withAuth(fileHandlers.list), POST: withAuth(fileHandlers.upload) },
  "/api/files/:id": { DELETE: withAuth(fileHandlers.remove) },
  "/api/files/:id/content": { GET: withAuth(fileHandlers.download) },
};

export function fallback(req: Request): Response {
  if (req.method === "OPTIONS") return noContent();
  return fail("Not found", 404);
}
