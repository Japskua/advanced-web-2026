// Integration tests for registration, login and the protected notes route.
// They use the database from .env; every user they create is removed again.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import path from "node:path";
import type { Server } from "bun";
import { SignJWT } from "jose";
import type { ApiResult, LoginResponse, Note, PublicUser } from "@shared/types";
import { errorHandler, fallback, routes } from "../src/router";
import { sql } from "../src/db/client";

let server: Server<undefined>;
let baseUrl: string;

// A unique address per test run, so the tests never collide with real data.
const email = `test-${crypto.randomUUID()}@example.com`;
const password = "correct horse battery";

beforeAll(async () => {
  await sql.file(path.join(import.meta.dir, "..", "sql", "schema.sql"));
  server = Bun.serve({ port: 0, routes, fetch: fallback, error: errorHandler });
  baseUrl = server.url.origin;
});

afterAll(async () => {
  server.stop(true);
  await sql`delete from users where email like 'test-%@example.com'`;
  await sql.close();
});

function post(path: string, body: unknown): Promise<Response> {
  return fetch(baseUrl + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function read<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
}

describe("registration", () => {
  test("creates a user and returns it without the password", async () => {
    const res = await post("/api/auth/register", { email: `  ${email.toUpperCase()} `, password });
    expect(res.status).toBe(201);

    const payload = await read<PublicUser>(res);
    if (!payload.ok) throw new Error(payload.error.message);
    expect(payload.data.email).toBe(email); // trimmed and lower-cased
    expect(Object.keys(payload.data).sort()).toEqual(["email", "id"]);
  });

  test("stores an argon2id hash, never the password", async () => {
    const [row] = await sql<{ password_hash: string }[]>`select password_hash from users where email = ${email}`;
    expect(row?.password_hash).toStartWith("$argon2id$");
    expect(row?.password_hash).not.toContain(password);
  });

  test("the same email again is 409 Conflict", async () => {
    const res = await post("/api/auth/register", { email, password });
    expect(res.status).toBe(409);
  });

  test.each([
    ["no body", undefined],
    ["a short password", { email: "short@example.com", password: "1234567" }],
    ["an invalid email", { email: "not-an-email", password: "long enough" }],
  ])("rejects %s with 400", async (_label, body) => {
    const res = await post("/api/auth/register", body);
    expect(res.status).toBe(400);
  });
});

describe("login and the protected route", () => {
  let token: string;

  test("valid credentials return a JWT", async () => {
    const res = await post("/api/auth/login", { email, password });
    expect(res.status).toBe(200);

    const payload = await read<LoginResponse>(res);
    if (!payload.ok) throw new Error(payload.error.message);
    token = payload.data.token;
    expect(token.split(".")).toHaveLength(3);
    expect(payload.data.user.email).toBe(email);
  });

  test("a wrong password and an unknown email give the same 401", async () => {
    const wrongPassword = await post("/api/auth/login", { email, password: "wrong password" });
    const unknownEmail = await post("/api/auth/login", { email: "nobody@example.com", password });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
  });

  test("GET /api/notes with the token returns the notes", async () => {
    const res = await fetch(`${baseUrl}/api/notes`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);

    const payload = await read<Note[]>(res);
    if (!payload.ok) throw new Error(payload.error.message);
    expect(payload.data.length).toBeGreaterThanOrEqual(3);
  });

  test("without a token it is 401", async () => {
    const res = await fetch(`${baseUrl}/api/notes`);
    expect(res.status).toBe(401);
  });

  test("a tampered token is rejected", async () => {
    // Change the payload part but keep the original signature.
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "someone-else", email: "x@example.com" })).toString(
      "base64url",
    );
    const res = await fetch(`${baseUrl}/api/notes`, {
      headers: { Authorization: `Bearer ${header}.${forgedPayload}.${signature}` },
    });
    expect(res.status).toBe(401);
  });

  test("a token signed with another secret is rejected", async () => {
    const forged = await new SignJWT({ email })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(crypto.randomUUID())
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("a-completely-different-secret-value!"));

    const res = await fetch(`${baseUrl}/api/notes`, { headers: { Authorization: `Bearer ${forged}` } });
    expect(res.status).toBe(401);
  });

  test("an expired token is rejected", async () => {
    const expired = await new SignJWT({ email })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(crypto.randomUUID())
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(Bun.env.JWT_SECRET));

    const res = await fetch(`${baseUrl}/api/notes`, { headers: { Authorization: `Bearer ${expired}` } });
    expect(res.status).toBe(401);
  });
});
