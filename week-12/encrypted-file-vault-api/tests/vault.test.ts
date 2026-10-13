// Integration tests for the vault: PostgreSQL and SeaweedFS (S3) from docker-compose.yml.
// The test plays the browser's role: it generates a real AES-GCM key and
// encrypts with Web Crypto, exactly like the client does.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import path from "node:path";
import type { Server } from "bun";
import type { ApiResult, FileDto, LoginResponse, UserDto } from "@shared/types";
import { sql } from "../src/db/client";
import { errorHandler } from "../src/errors";
import { fallback, routes } from "../src/routes";
import { checkStorage, getObject } from "../src/services/object-storage";

let server: Server<undefined>;
let baseUrl: string;

const run = crypto.randomUUID().slice(0, 8);
const password = "Str0ng!Password";

beforeAll(async () => {
  await sql.file(path.join(import.meta.dir, "..", "sql", "schema.sql"));
  await checkStorage();
  server = Bun.serve({ port: 0, routes, fetch: fallback, error: errorHandler });
  baseUrl = server.url.origin;
});

afterAll(async () => {
  server.stop(true);
  await sql`delete from users where email like 'test-%@example.com'`;
  await sql.close();
});

async function api(method: string, path: string, options: { token?: string; json?: unknown; form?: FormData } = {}) {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.json !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(baseUrl + path, {
    method,
    headers,
    body: options.form ?? (options.json === undefined ? undefined : JSON.stringify(options.json)),
  });
  return res;
}

async function data<T>(res: Response): Promise<T> {
  const payload = (await res.json()) as ApiResult<T>;
  if (!payload.ok) throw new Error(`${res.status}: ${payload.error.message}`);
  return payload.data;
}

async function registerAndLogin(name: string): Promise<string> {
  const email = `test-${name}-${run}@example.com`;
  const reg = await api("POST", "/api/auth/register", { json: { email, password, inviteCode: Bun.env.INVITE_CODE } });
  expect(reg.status).toBe(201);
  const { token } = await data<LoginResponse>(await api("POST", "/api/auth/login", { json: { email, password } }));
  return token;
}

// --- The browser's side, with Web Crypto ------------------------------------
async function newKey() {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  const fingerprint = new Uint8Array(await crypto.subtle.digest("SHA-256", raw)).toHex();
  return { key, fingerprint };
}

async function encryptedUpload(key: CryptoKey, fingerprint: string, plaintext: Uint8Array<ArrayBuffer>, name = "secret.txt") {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));

  const form = new FormData();
  form.append("file", new Blob([ciphertext]), name);
  form.append("originalFilename", name);
  form.append("contentType", "text/plain");
  form.append("sizeBytes", String(plaintext.length));
  form.append("encryptionAlgorithm", "AES-GCM");
  form.append("encryptionIv", iv.toBase64());
  form.append("keyFingerprint", fingerprint);
  return form;
}

describe("health and registration", () => {
  test("GET /api/health", async () => {
    expect(await data<{ status: string }>(await api("GET", "/api/health"))).toEqual({ status: "up" });
  });

  test("a wrong invitation code is 403, a weak password 400", async () => {
    const email = `test-x-${run}@example.com`;
    expect((await api("POST", "/api/auth/register", { json: { email, password, inviteCode: "nope" } })).status).toBe(403);
    expect(
      (await api("POST", "/api/auth/register", { json: { email, password: "weak", inviteCode: Bun.env.INVITE_CODE } }))
        .status,
    ).toBe(400);
  });
});

describe("the encrypted file lifecycle", () => {
  let token: string;
  let key: CryptoKey;
  let fingerprint: string;
  let uploaded: FileDto;
  const plaintext = new TextEncoder().encode("Top secret: the exam questions 🙈");

  beforeAll(async () => {
    token = await registerAndLogin("owner");
    ({ key, fingerprint } = await newKey());
  });

  test("uploading before onboarding is refused", async () => {
    const res = await api("POST", "/api/files", { token, form: await encryptedUpload(key, fingerprint, plaintext) });
    expect(res.status).toBe(403);
  });

  test("onboarding stores the fingerprint, exactly once", async () => {
    const user = await data<UserDto>(await api("POST", "/api/auth/onboarding", { token, json: { keyFingerprint: fingerprint } }));
    expect(user.keyFingerprint).toBe(fingerprint);

    const again = await api("POST", "/api/auth/onboarding", { token, json: { keyFingerprint: fingerprint } });
    expect(again.status).toBe(409);
  });

  test("an encrypted upload is stored and listed", async () => {
    const res = await api("POST", "/api/files", { token, form: await encryptedUpload(key, fingerprint, plaintext) });
    expect(res.status).toBe(201);
    uploaded = await data<FileDto>(res);
    expect(uploaded).toMatchObject({ originalFilename: "secret.txt", sizeBytes: plaintext.length, encryptionAlgorithm: "AES-GCM" });

    const list = await data<FileDto[]>(await api("GET", "/api/files", { token }));
    expect(list.map((f) => f.id)).toContain(uploaded.id);
  });

  test("the server stores ciphertext only; the owner can decrypt it", async () => {
    const res = await api("GET", `/api/files/${uploaded.id}/content`, { token });
    expect(res.status).toBe(200);
    const ciphertext = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(ciphertext)).not.toContain("Top secret");

    const iv = Uint8Array.fromBase64(uploaded.encryptionIv);
    const decrypted = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext));
    expect(new TextDecoder().decode(decrypted)).toBe("Top secret: the exam questions 🙈");
  });

  test("a file encrypted with another key is refused", async () => {
    const other = await newKey();
    const res = await api("POST", "/api/files", { token, form: await encryptedUpload(other.key, other.fingerprint, plaintext) });
    expect(res.status).toBe(403);
  });

  test("a size that does not match the ciphertext is refused", async () => {
    const form = await encryptedUpload(key, fingerprint, plaintext);
    form.set("sizeBytes", "1");
    expect((await api("POST", "/api/files", { token, form })).status).toBe(400);
  });

  test("another user cannot see, download or delete the file", async () => {
    const intruder = await registerAndLogin("intruder");
    expect(await data<FileDto[]>(await api("GET", "/api/files", { token: intruder }))).toEqual([]);
    expect((await api("GET", `/api/files/${uploaded.id}/content`, { token: intruder })).status).toBe(404);
    expect((await api("DELETE", `/api/files/${uploaded.id}`, { token: intruder })).status).toBe(404);
  });

  test("the owner deletes it: the row and the object are gone", async () => {
    expect((await api("DELETE", `/api/files/${uploaded.id}`, { token })).status).toBe(204);
    expect((await api("GET", `/api/files/${uploaded.id}/content`, { token })).status).toBe(404);
    expect(await sql`select id from files where id = ${uploaded.id}`).toHaveLength(0);

    const me = await data<UserDto>(await api("GET", "/api/auth/me", { token }));
    await expect(getObject(`${me.id}/${uploaded.id}`)).rejects.toThrow(); // the object no longer exists
  });

  test("without a token everything is 401", async () => {
    expect((await api("GET", "/api/files")).status).toBe(401);
    expect((await api("GET", "/api/auth/me")).status).toBe(401);
  });
});

describe("login rate limiting", () => {
  test("the sixth failed attempt is 429 with Retry-After", async () => {
    const email = `test-limited-${run}@example.com`;
    for (let i = 0; i < 5; i++) {
      expect((await api("POST", "/api/auth/login", { json: { email, password: `wrong-${i}` } })).status).toBe(401);
    }
    const res = await api("POST", "/api/auth/login", { json: { email, password: "wrong" } });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  test("parallel guesses cannot get past the limit", async () => {
    const email = `test-burst-${run}@example.com`;
    const replies = await Promise.all(
      Array.from({ length: 12 }, (_, i) => api("POST", "/api/auth/login", { json: { email, password: `guess-${i}` } })),
    );
    const statuses = replies.map((res) => res.status);
    expect(statuses.filter((status) => status === 401)).toHaveLength(5);
    expect(statuses.filter((status) => status === 429)).toHaveLength(7);
  });
});
