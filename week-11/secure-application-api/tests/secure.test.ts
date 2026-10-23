// The same attacks as vulnerable.test.ts, against the secure version: each
// test asserts that the attack FAILS.
import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { ALLOWED_ORIGIN } from "../src/config";
import { secureSql as sql } from "../src/db";
import { app, internalError } from "../src/secure/app";
import { resetDatabase, SEED_NOTES, SEED_USERS } from "../src/seed";
import { call, login, startApp, type TestApp } from "./helpers";

const [admin, alice, bob] = SEED_USERS;
const [adminNote, aliceNote, bobNote] = SEED_NOTES;
let api: TestApp;
let aliceToken: string;
let adminToken: string;

beforeAll(async () => {
  await resetDatabase(sql, "secure");
  api = startApp(app);
  aliceToken = await login(api.url, alice.email, alice.password);
  adminToken = await login(api.url, admin.email, admin.password);
});

afterAll(async () => {
  api.stop();
  await resetDatabase(sql, "secure");
});

describe("A01 Broken Access Control: fixed", () => {
  test("the audit log ignores ?role= and requires a real admin", async () => {
    expect((await call(api.url, "GET", "/api/admin/audit?role=admin")).status).toBe(401);
    expect((await call(api.url, "GET", "/api/admin/audit?role=admin", { token: aliceToken })).status).toBe(403);
    expect((await call(api.url, "GET", "/api/admin/audit", { token: adminToken })).status).toBe(200);
  });

  test("Alice cannot read Bob's note; she gets 404, as if it did not exist", async () => {
    expect((await call(api.url, "GET", `/api/notes/${bobNote.id}`, { token: aliceToken })).status).toBe(404);
    expect((await call(api.url, "GET", `/api/notes/${aliceNote.id}`, { token: aliceToken })).status).toBe(200);
    expect((await call(api.url, "GET", `/api/notes/${bobNote.id}`, { token: adminToken })).status).toBe(200);
  });

  test("deleting a user requires the admin role", async () => {
    expect((await call(api.url, "DELETE", `/api/users/${bob.id}`)).status).toBe(401);
    expect((await call(api.url, "DELETE", `/api/users/${bob.id}`, { token: aliceToken })).status).toBe(403);
    expect((await call(api.url, "DELETE", `/api/users/${bob.id}`, { token: adminToken })).status).toBe(200);
  });
});

describe("A02 Security Misconfiguration: fixed", () => {
  test("there is no debug endpoint", async () => {
    expect((await call(api.url, "GET", "/api/debug/config")).status).toBe(404);
  });

  test("CORS allows only the client's origin", async () => {
    const evil = await call(api.url, "OPTIONS", "/api/login", { headers: { Origin: "https://evil.example" } });
    expect(evil.headers.get("access-control-allow-origin")).not.toBe("https://evil.example");
    expect(evil.headers.get("access-control-allow-origin")).not.toBe("*");
    const client = await call(api.url, "OPTIONS", "/api/login", { headers: { Origin: ALLOWED_ORIGIN } });
    expect(client.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
  });

  test("unexpected errors reveal nothing", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    const body = internalError(new Error('duplicate key value violates unique constraint "users_email_key"'));
    consoleError.mockRestore();

    expect(body).toEqual({ ok: false, error: "Internal server error" });
  });
});

describe("A04 Cryptographic Failures: fixed", () => {
  test("passwords are stored as Argon2id hashes", async () => {
    const rows = await sql<{ password_hash: string }[]>`select password_hash from users where email = ${alice.email}`;
    expect(rows[0]?.password_hash).toStartWith("$argon2id$");
  });

  test("a forged Base64 token is rejected", async () => {
    const forged = btoa(JSON.stringify({ userId: admin.id, email: admin.email, role: "admin" }));
    expect((await call(api.url, "GET", `/api/notes/${adminNote.id}`, { token: forged })).status).toBe(401);
  });

  test("a real token with an edited payload is rejected", async () => {
    const [header, , signature] = aliceToken.split(".");
    const payload = Buffer.from(JSON.stringify({ sub: admin.id })).toString("base64url");
    const tampered = `${header}.${payload}.${signature}`;
    expect((await call(api.url, "GET", "/api/admin/audit", { token: tampered })).status).toBe(401);
  });
});

describe("A05 Injection: fixed", () => {
  test("the injection string is just an email that does not exist", async () => {
    const reply = await call(api.url, "GET", `/api/users/search?email=${encodeURIComponent("' OR '1'='1")}`, {
      token: aliceToken,
    });
    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ ok: true, data: [] });
  });

  test("a normal search returns no password data and needs a login", async () => {
    const reply = await call(api.url, "GET", `/api/users/search?email=${alice.email}`, { token: aliceToken });
    expect(reply.body.data).toEqual([{ id: alice.id, email: alice.email, role: "user" }]);
    expect((await call(api.url, "GET", `/api/users/search?email=${alice.email}`)).status).toBe(401);
  });
});

describe("A07 Authentication Failures: fixed", () => {
  test("unknown email and wrong password get the same answer", async () => {
    const unknown = await call(api.url, "POST", "/api/login", { body: { email: "nobody@example.com", password: "x" } });
    const wrong = await call(api.url, "POST", "/api/login", { body: { email: alice.email, password: "x" } });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  test("weak passwords are refused at registration", async () => {
    const weak = await call(api.url, "POST", "/api/register", { body: { email: "weak@example.com", password: "abcd" } });
    expect(weak.status).toBe(400);
    const strong = await call(api.url, "POST", "/api/register", {
      body: { email: "strong@example.com", password: "Str0ng!Passw0rd" },
    });
    expect(strong.status).toBe(201);
  });

  test("after 5 failed attempts the login is locked with 429 + Retry-After", async () => {
    const email = "strong@example.com"; // registered in the previous test
    for (let i = 0; i < 5; i++) {
      const reply = await call(api.url, "POST", "/api/login", { body: { email, password: `guess${i}` } });
      expect(reply.status).toBe(401);
    }

    // Even the correct password is refused until the window ends.
    const locked = await call(api.url, "POST", "/api/login", { body: { email, password: "Str0ng!Passw0rd" } });
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get("retry-after"))).toBeGreaterThan(0);

    // Other accounts are not affected.
    expect(await login(api.url, alice.email, alice.password)).toBeTruthy();
  });

  test("a burst of parallel guesses cannot get past the limit", async () => {
    const email = "burst@example.com";
    const replies = await Promise.all(
      Array.from({ length: 20 }, (_, i) => call(api.url, "POST", "/api/login", { body: { email, password: `guess${i}` } })),
    );
    const statuses = replies.map((reply) => reply.status);
    expect(statuses.filter((status) => status === 401)).toHaveLength(5);
    expect(statuses.filter((status) => status === 429)).toHaveLength(15);
  });
});
