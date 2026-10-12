import type { AuthUser } from "../types";
import { createNotification, listNotifications } from "../services/notification-service";
import { ok } from "../util/response";
import { parseCreateNotificationBody, readJson } from "../util/validation";

// GET /api/notifications – any authenticated user.
// The underscore marks parameters this handler does not need.
export async function list(_req: Request, _user: AuthUser): Promise<Response> {
  return ok(await listNotifications());
}

// POST /api/admin/notifications – admins only.
export async function create(req: Request, user: AuthUser): Promise<Response> {
  const input = parseCreateNotificationBody(await readJson(req));
  return ok(await createNotification(user, input), 201);
}
