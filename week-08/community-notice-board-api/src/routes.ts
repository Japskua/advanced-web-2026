/**
 * The route table: every endpoint of the API on one screen, with its access
 * rule. Reading this file answers "who may call what?" without opening any
 * handler.
 *
 *   public            anyone
 *   withAuth(...)     any logged-in user
 *   withAdmin(...)    logged-in users with the admin role
 */
import * as authHandlers from "./handlers/auth-handlers";
import * as notificationHandlers from "./handlers/notification-handlers";
import * as userHandlers from "./handlers/user-handlers";
import { withAdmin, withAuth } from "./middleware/auth";
import { fail, noContent } from "./util/response";

export const routes = {
  // public
  "/api/auth/register": { POST: authHandlers.register },
  "/api/auth/login": { POST: authHandlers.login },

  // any authenticated user
  "/api/auth/me": { GET: withAuth(authHandlers.me) },
  "/api/notifications": { GET: withAuth(notificationHandlers.list) },

  // administrators only
  "/api/admin/notifications": { POST: withAdmin(notificationHandlers.create) },
  "/api/admin/users": { GET: withAdmin(userHandlers.list) },
  "/api/admin/users/:id": { DELETE: withAdmin(userHandlers.remove) },
};

export function fallback(req: Request): Response {
  if (req.method === "OPTIONS") return noContent(); // CORS preflight
  return fail("Not found", 404);
}
