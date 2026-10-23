/**
 * The route table: every endpoint of the API on one screen, with its access
 * rule and the schema of its input. Reading this file answers "who may call
 * what, with what?" without opening anything else.
 *
 *   (no option)          anyone
 *   auth: true           any logged-in user
 *   role: "admin"        logged-in users with the admin role
 *
 * This file is the HTTP layer. Last week it took routes.ts plus three handler
 * files to read and validate the input; now Elysia does that from the schemas,
 * so each handler is one line: clean the input, call a service, respond.
 */
import { Elysia } from "elysia";
import { auth } from "./plugins/auth";
import {
  cleanCredentials,
  cleanNotification,
  cleanRegistration,
  createNotificationBody,
  credentialsBody,
  userIdParams,
} from "./schemas";
import { loginUser, registerUser } from "./services/auth-service";
import { createNotification, listNotifications } from "./services/notification-service";
import { deleteUser, getCurrentUser, listUsers } from "./services/user-service";
import { ok } from "./util/response";

export const routes = new Elysia({ prefix: "/api" })
  .use(auth)

  // public
  .post("/auth/register", async ({ body, status }) => {
    const { email, password } = cleanRegistration(body);
    return status(201, ok(await registerUser(email, password)));
  }, { body: credentialsBody })
  .post("/auth/login", async ({ body }) => {
    const { email, password } = cleanCredentials(body);
    return ok(await loginUser(email, password));
  }, { body: credentialsBody })

  // any authenticated user
  .get("/auth/me", async ({ user }) => ok(await getCurrentUser(user.id)), { auth: true })
  .get("/notifications", async () => ok(await listNotifications()), { auth: true })

  // administrators only
  .post("/admin/notifications", async ({ body, user, status }) => {
    return status(201, ok(await createNotification(user, cleanNotification(body))));
  }, { role: "admin", body: createNotificationBody })
  .get("/admin/users", async () => ok(await listUsers()), { role: "admin" })
  .delete("/admin/users/:id", async ({ params, user, status }) => {
    await deleteUser(user, params.id);
    return status(204);
  }, { role: "admin", params: userIdParams });
