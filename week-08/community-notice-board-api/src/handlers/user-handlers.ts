import type { BunRequest } from "bun";
import type { AuthUser } from "../types";
import { deleteUser, listUsers } from "../services/user-service";
import { noContent, ok } from "../util/response";
import { parseUuid } from "../util/validation";

// GET /api/admin/users – admins only.
export async function list(_req: Request, _user: AuthUser): Promise<Response> {
  return ok(await listUsers());
}

// DELETE /api/admin/users/:id – admins only.
export async function remove(req: BunRequest<"/api/admin/users/:id">, user: AuthUser): Promise<Response> {
  const userId = parseUuid(req.params.id, "user id");
  await deleteUser(user, userId);
  return noContent();
}
