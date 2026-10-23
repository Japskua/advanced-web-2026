// Proof that every vulnerability in the vulnerable version is real: each test
// performs the attack and asserts that it SUCCEEDS.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { vulnerableSql as sql } from "../src/db";
import { resetDatabase, SEED_NOTES, SEED_USERS } from "../src/seed";
import { app } from "../src/vulnerable/app";
import { call, login, startApp, type TestApp } from "./helpers";

const [admin, alice, bob] = SEED_USERS;
const [adminNote, , bobNote] = SEED_NOTES;
let api: TestApp;

beforeAll(async () => {
  await resetDatabase(sql, "vulnerable");
  api = startApp(app);
});

afterAll(async () => {
  api.stop();
  await resetDatabase(sql, "vulnerable"); // leave the demo data intact
});

describe("A01 Broken Access Control", () => {
  test("?role=admin in the URL unlocks the admin audit log", async () => {
    expect((await call(api.url, "GET", "/api/admin/audit?role=user")).status).toBe(403);
    const reply = await call(api.url, "GET", "/api/admin/audit?role=admin");
    expect(reply.status).toBe(200);
    expect(reply.body.data.message).toBe("Top secret admin audit log");
  });

  test("Alice can read Bob's private note by changing the id (IDOR)", async () => {
    const token = await login(api.url, alice.email, alice.password);
    const reply = await call(api.url, "GET", `/api/notes/${bobNote.id}`, { token });
    expect(reply.status).toBe(200);
    expect(reply.body.data.content).toBe("Bob's private note");
  });

  test("anyone can delete any user, without a token", async () => {
    const reply = await call(api.url, "DELETE", `/api/users/${bob.id}`);
    expect(reply.status).toBe(200);
    expect(await sql`select id from users where id = ${bob.id}`).toHaveLength(0);
  });
});

describe("A02 Security Misconfiguration", () => {
  test("the debug endpoint hands out the database URL with its password", async () => {
    const reply = await call(api.url, "GET", "/api/debug/config");
    expect(reply.status).toBe(200);
    expect(reply.body.environment.databaseUrl).toContain("postgres:postgres@");
  });

  test("errors are sent to the client with database details and a stack trace", async () => {
    const reply = await call(api.url, "POST", "/api/register", { body: { email: alice.email, password: "whatever" } });
    expect(reply.status).toBe(500);
    expect(reply.body.error).toContain("duplicate key value violates unique constraint");
    expect(reply.body.stack).toContain("PostgresError"); // the server's internals, in the response
  });

  test("CORS allows any origin", async () => {
    const reply = await call(api.url, "OPTIONS", "/api/debug/config", { headers: { Origin: "https://evil.example" } });
    expect(reply.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("A04 Cryptographic Failures", () => {
  test("passwords are stored in plain text", async () => {
    const rows = await sql<{ password: string }[]>`select password from users where email = ${alice.email}`;
    expect(rows[0]?.password).toBe(alice.password);
  });

  test("the token is Base64 JSON: a forged admin token is accepted", async () => {
    // No login at all: just write the token yourself.
    const forged = btoa(JSON.stringify({ userId: "attacker", email: "attacker@evil.example", role: "admin" }));
    const reply = await call(api.url, "GET", `/api/notes/${adminNote.id}`, { token: forged });
    expect(reply.status).toBe(200);
    expect(reply.body.data.content).toBe("Sensitive admin content");
  });
});

describe("A05 Injection", () => {
  test("' OR '1'='1 returns every user, with passwords and the executed SQL", async () => {
    const reply = await call(api.url, "GET", `/api/users/search?email=${encodeURIComponent("' OR '1'='1")}`);
    expect(reply.status).toBe(200);
    expect(reply.body.data.length).toBeGreaterThanOrEqual(2);
    expect(reply.body.data.map((u: { password: string }) => u.password)).toContain(admin.password);
    expect(reply.body.executedQuery).toBe("select id, email, role, password from users where email = '' OR '1'='1'");
  });
});

describe("A07 Authentication Failures", () => {
  test("different answers reveal which emails are registered", async () => {
    const unknown = await call(api.url, "POST", "/api/login", { body: { email: "nobody@example.com", password: "x" } });
    const wrong = await call(api.url, "POST", "/api/login", { body: { email: alice.email, password: "x" } });
    expect(unknown).toMatchObject({ status: 404, body: { error: "User does not exist" } });
    expect(wrong).toMatchObject({ status: 401, body: { error: "Wrong password" } });
  });

  test("a 4-character password is accepted", async () => {
    const reply = await call(api.url, "POST", "/api/register", { body: { email: "weak@example.com", password: "abcd" } });
    expect(reply.status).toBe(201);
  });

  test("unlimited guessing: 20 wrong passwords, then the right one still works", async () => {
    for (let i = 0; i < 20; i++) {
      const reply = await call(api.url, "POST", "/api/login", { body: { email: alice.email, password: `guess${i}` } });
      expect(reply.status).toBe(401);
    }
    expect(await login(api.url, alice.email, alice.password)).toBeTruthy();
  });
});
