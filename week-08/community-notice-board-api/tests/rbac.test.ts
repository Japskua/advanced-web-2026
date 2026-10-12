// Integration tests for authentication, role-based access control and the
// error handling. Test accounts use unique "test-…@example.com" addresses and
// are deleted afterwards (their notifications go with them: on delete cascade).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import path from "node:path";
import type { Server } from "bun";
import type { ApiResult, LoginResponse, NotificationDto, UserDto } from "@shared/types";
import { sql } from "../src/db/client";
import { errorHandler } from "../src/errors";
import { fallback, routes } from "../src/routes";
import { registerUser } from "../src/services/auth-service";

let server: Server<undefined>;
let baseUrl: string;

const run = crypto.randomUUID().slice(0, 8);
const adminEmail = `test-admin-${run}@example.com`;
const userEmail = `test-user-${run}@example.com`;
const password = "Str0ng!Password";

let adminToken: string;
let userToken: string;
let userId: string;

async function api<T>(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = res.status === 204 ? null : ((await res.json()) as ApiResult<T>);
  return { status: res.status, payload };
}

async function login(email: string): Promise<string> {
  const { payload } = await api<LoginResponse>("POST", "/api/auth/login", undefined, { email, password });
  if (!payload?.ok) throw new Error("login failed");
  return payload.data.token;
}

beforeAll(async () => {
  await sql.file(path.join(import.meta.dir, "..", "sql", "schema.sql"));
  server = Bun.serve({ port: 0, routes, fetch: fallback, error: errorHandler });
  baseUrl = server.url.origin;

  // An admin can only be created outside the API (like the seed script does).
  await registerUser(adminEmail, password, "admin");
  adminToken = await login(adminEmail);
});

afterAll(async () => {
  server.stop(true);
  await sql`delete from users where email like 'test-%@example.com'`;
  await sql.close();
});

describe("registration and login", () => {
  test("registering through the API always creates a plain user", async () => {
    const { status, payload } = await api<UserDto>("POST", "/api/auth/register", undefined, {
      email: userEmail,
      password,
      role: "admin", // ignored: the client cannot choose its role
    });
    expect(status).toBe(201);
    if (!payload?.ok) throw new Error("expected success");
    expect(payload.data).toMatchObject({ email: userEmail, role: "user" });
    expect(payload.data).not.toHaveProperty("passwordHash");

    userId = payload.data.id;
    userToken = await login(userEmail);
  });

  test("the password policy lists what is missing", async () => {
    const { status, payload } = await api("POST", "/api/auth/register", undefined, {
      email: `test-weak-${run}@example.com`,
      password: "weakpass",
    });
    expect(status).toBe(400);
    expect(payload).toEqual({
      ok: false,
      error: { message: "The password must contain an uppercase letter, a number, a special character." },
    });
  });

  test("login does not apply the password policy, it just fails", async () => {
    const { status, payload } = await api("POST", "/api/auth/login", undefined, { email: userEmail, password: "weak" });
    expect(status).toBe(401);
    expect(payload).toEqual({ ok: false, error: { message: "Invalid email or password" } });
  });

  test("a duplicate email is 409", async () => {
    const { status } = await api("POST", "/api/auth/register", undefined, { email: userEmail, password });
    expect(status).toBe(409);
  });

  test("malformed JSON is 400, not 500", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", body: "{oops" });
    expect(res.status).toBe(400);
  });

  test("GET /api/auth/me returns the caller", async () => {
    const { payload } = await api<UserDto>("GET", "/api/auth/me", userToken);
    expect(payload).toMatchObject({ ok: true, data: { email: userEmail, role: "user" } });
  });
});

describe("role-based access control", () => {
  test("an admin can create a notification", async () => {
    const { status, payload } = await api<NotificationDto>("POST", "/api/admin/notifications", adminToken, {
      title: "  Water break  ",
      content: "The water will be off on Monday.",
    });
    expect(status).toBe(201);
    expect(payload).toMatchObject({ ok: true, data: { title: "Water break", author: { email: adminEmail } } });
  });

  test("a user can read notifications, with the author's email (a DTO, not the row)", async () => {
    const { status, payload } = await api<NotificationDto[]>("GET", "/api/notifications", userToken);
    expect(status).toBe(200);
    if (!payload?.ok) throw new Error("expected success");
    const ours = payload.data.find((n) => n.author.email === adminEmail);
    expect(ours).toBeDefined();
    expect(Object.keys(ours!).sort()).toEqual(["author", "content", "createdAt", "id", "title"]);
  });

  test("a user cannot create notifications: 403", async () => {
    const { status } = await api("POST", "/api/admin/notifications", userToken, { title: "x", content: "y" });
    expect(status).toBe(403);
  });

  test("a user cannot list users: 403", async () => {
    expect((await api("GET", "/api/admin/users", userToken)).status).toBe(403);
  });

  test("without a token: 401", async () => {
    expect((await api("GET", "/api/notifications")).status).toBe(401);
    expect((await api("GET", "/api/admin/users")).status).toBe(401);
  });

  test("an admin lists users without password hashes", async () => {
    const { payload } = await api<UserDto[]>("GET", "/api/admin/users", adminToken);
    if (!payload?.ok) throw new Error("expected success");
    expect(payload.data.some((u) => u.email === userEmail)).toBe(true);
    expect(JSON.stringify(payload.data)).not.toContain("argon2");
  });

  test("an admin cannot delete their own account", async () => {
    const me = await api<UserDto>("GET", "/api/auth/me", adminToken);
    if (!me.payload?.ok) throw new Error("expected success");
    const { status } = await api("DELETE", `/api/admin/users/${me.payload.data.id}`, adminToken);
    expect(status).toBe(400);
  });

  test("invalid and unknown user ids", async () => {
    expect((await api("DELETE", "/api/admin/users/not-a-uuid", adminToken)).status).toBe(400);
    expect((await api("DELETE", `/api/admin/users/${crypto.randomUUID()}`, adminToken)).status).toBe(404);
  });

  test("a deleted user's token stops working immediately", async () => {
    expect((await api("DELETE", `/api/admin/users/${userId}`, adminToken)).status).toBe(204);

    const { status, payload } = await api("GET", "/api/notifications", userToken);
    expect(status).toBe(401);
    expect(payload).toEqual({ ok: false, error: { message: "Account no longer exists" } });
  });
});
