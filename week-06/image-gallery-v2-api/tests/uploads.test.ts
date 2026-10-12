// Integration tests: they use the real PostgreSQL database from .env (start it
// with `docker compose up -d` in the repository root) and a temporary folder
// for the image files. Every row a test creates is deleted at the end.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Server } from "bun";
import type { ApiResult, UploadRecord } from "@shared/types";

const tmp = await mkdtemp(path.join(os.tmpdir(), "image-gallery-v2-test-"));
process.env.UPLOADS_DIR = tmp;

const { routes, fallback, errorHandler } = await import("../src/router");
const { sql } = await import("../src/db/client");

const PNG_BYTES = Uint8Array.fromBase64(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
);

let server: Server<undefined>;
let baseUrl: string;
const createdIds: string[] = [];

beforeAll(async () => {
  await sql.file(path.join(import.meta.dir, "..", "sql", "schema.sql"));
  server = Bun.serve({ port: 0, routes, fetch: fallback, error: errorHandler });
  baseUrl = server.url.origin;
});

afterAll(async () => {
  server.stop(true);
  if (createdIds.length > 0) await sql`delete from uploads where id in ${sql(createdIds)}`;
  await sql.close();
  await rm(tmp, { recursive: true, force: true });
});

async function read<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
}

async function uploadPng(name = "pixel.png"): Promise<UploadRecord> {
  const form = new FormData();
  form.append("image", new File([PNG_BYTES], name, { type: "image/png" }));
  const res = await fetch(`${baseUrl}/api/uploads`, { method: "POST", body: form });
  expect(res.status).toBe(201);

  const payload = await read<UploadRecord>(res);
  if (!payload.ok) throw new Error(payload.error.message);
  createdIds.push(payload.data.id);
  return payload.data;
}

describe("upload, list, delete", () => {
  test("an upload creates a database row and a file", async () => {
    const record = await uploadPng("first.png");

    const rows = await sql`select original_name, size from uploads where id = ${record.id}`;
    expect(rows).toEqual([{ original_name: "first.png", size: PNG_BYTES.length }]);
    expect(await Bun.file(path.join(tmp, record.filename)).exists()).toBe(true);
  });

  test("the timestamp comes from the database and the list is newest first", async () => {
    const older = await uploadPng("older.png");
    const newer = await uploadPng("newer.png");
    expect(Date.parse(newer.uploadedAt)).toBeGreaterThanOrEqual(Date.parse(older.uploadedAt));

    const list = await read<UploadRecord[]>(await fetch(`${baseUrl}/api/uploads`));
    if (!list.ok) throw new Error("expected success");
    const ids = list.data.map((u) => u.id);
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
  });

  test("DELETE removes both the row and the file", async () => {
    const record = await uploadPng("doomed.png");

    const res = await fetch(`${baseUrl}/api/uploads/${record.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await read<UploadRecord>(res)).toEqual({ ok: true, data: record });

    expect(await sql`select id from uploads where id = ${record.id}`).toHaveLength(0);
    expect(await Bun.file(path.join(tmp, record.filename)).exists()).toBe(false);

    const again = await fetch(`${baseUrl}/api/uploads/${record.id}`, { method: "DELETE" });
    expect(again.status).toBe(404);
  });
});

describe("validation", () => {
  test("a malformed id is rejected before it reaches the database", async () => {
    const res = await fetch(`${baseUrl}/api/uploads/not-a-uuid`, { method: "DELETE" });
    expect(res.status).toBe(400);
    expect(await read<never>(res)).toEqual({ ok: false, error: { message: "Invalid upload id." } });
  });

  test("a fake image is still rejected", async () => {
    const form = new FormData();
    form.append("image", new File(["<html>"], "page.png", { type: "image/png" }));
    const res = await fetch(`${baseUrl}/api/uploads`, { method: "POST", body: form });
    expect(res.status).toBe(415);
  });

  test("a DELETE preflight is allowed", async () => {
    const res = await fetch(`${baseUrl}/api/uploads/${crypto.randomUUID()}`, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("DELETE");
  });
});

describe("parameterised queries", () => {
  test("a value that looks like SQL is stored as plain text", async () => {
    const evilName = "x'); drop table uploads; --.png";
    const record = await uploadPng(evilName);

    const rows = await sql`select original_name from uploads where id = ${record.id}`;
    expect(rows).toEqual([{ original_name: evilName }]);
  });
});
