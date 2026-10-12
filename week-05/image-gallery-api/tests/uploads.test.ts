// Tests for the image gallery API. They run in a temporary folder, so they
// never touch the real uploads/ and data/ folders.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Server } from "bun";
import type { ApiResult, UploadRecord } from "@shared/types";

// config.ts reads these when it is first imported, so set them before
// importing the application (a dynamic import runs after this code; a normal
// import statement would run before it).
const tmp = await mkdtemp(path.join(os.tmpdir(), "image-gallery-test-"));
process.env.UPLOADS_DIR = path.join(tmp, "uploads");
process.env.DATA_DIR = path.join(tmp, "data");

const { routes, fallback } = await import("../src/router");
const { ensureStorage } = await import("../src/services/upload-service");
const { applyMiddleware } = await import("../src/middleware/middleware");

// A real 1×1 pixel PNG.
const PNG_BYTES = Uint8Array.fromBase64(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
);

let server: Server<undefined>;
let baseUrl: string;

beforeAll(async () => {
  await ensureStorage();
  server = Bun.serve({ port: 0, routes, fetch: fallback });
  baseUrl = server.url.origin;
});

afterAll(async () => {
  server.stop(true);
  await rm(tmp, { recursive: true, force: true });
});

function upload(file: File, field = "image"): Promise<Response> {
  const form = new FormData();
  form.append(field, file);
  // No content-type header: fetch sets multipart/form-data with the boundary.
  return fetch(`${baseUrl}/api/uploads`, { method: "POST", body: form });
}

async function read<T>(res: Response): Promise<ApiResult<T>> {
  return (await res.json()) as ApiResult<T>;
}

describe("uploading", () => {
  let record: UploadRecord;

  test("a valid PNG is stored and described", async () => {
    const res = await upload(new File([PNG_BYTES], "pixel.png", { type: "image/png" }));
    expect(res.status).toBe(201);

    const payload = await read<UploadRecord>(res);
    if (!payload.ok) throw new Error(payload.error.message);
    record = payload.data;

    expect(record).toMatchObject({ originalName: "pixel.png", mimeType: "image/png", size: PNG_BYTES.length });
    expect(record.filename).toBe(`${record.id}.png`);
    expect(record.url).toBe(`/uploads/${record.filename}`);
    expect(await readdir(process.env.UPLOADS_DIR!)).toContain(record.filename);
  });

  test("the metadata is listed", async () => {
    const payload = await read<UploadRecord[]>(await fetch(`${baseUrl}/api/uploads`));
    expect(payload).toEqual({ ok: true, data: [record] });
  });

  test("the image is served with the right headers", async () => {
    const res = await fetch(`${baseUrl}${record.url}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG_BYTES);
  });
});

describe("rejected uploads", () => {
  test("a text file is 415 Unsupported Media Type", async () => {
    const res = await upload(new File(["hello"], "notes.txt", { type: "text/plain" }));
    expect(res.status).toBe(415);
  });

  test("HTML pretending to be a PNG is caught by the magic-byte check", async () => {
    const res = await upload(new File(["<script>alert(1)</script>"], "evil.png", { type: "image/png" }));
    expect(res.status).toBe(415);
    expect(await read<never>(res)).toEqual({
      ok: false,
      error: { message: "The file content does not match its image type." },
    });
  });

  test("a file over 5 MB is 413", async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(PNG_BYTES);
    const res = await upload(new File([big], "big.png", { type: "image/png" }));
    expect(res.status).toBe(413);
  });

  test("an empty file is 400", async () => {
    const res = await upload(new File([], "empty.png", { type: "image/png" }));
    expect(res.status).toBe(400);
  });

  test("a missing 'image' field is 400", async () => {
    const res = await upload(new File([PNG_BYTES], "pixel.png", { type: "image/png" }), "picture");
    expect(res.status).toBe(400);
  });

  test("a JSON body is 400", async () => {
    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
  });
});

describe("serving files", () => {
  test("a name we never generated is rejected", async () => {
    expect((await fetch(`${baseUrl}/uploads/..%2Fdata%2Fuploads.json`)).status).toBe(400);
    expect((await fetch(`${baseUrl}/uploads/hello.png`)).status).toBe(400);
  });

  test("a well-formed but unknown name is 404", async () => {
    const res = await fetch(`${baseUrl}/uploads/${crypto.randomUUID()}.png`);
    expect(res.status).toBe(404);
  });
});

describe("logging middleware", () => {
  test("applyMiddleware wraps every handler in the routes table", async () => {
    const calls: string[] = [];
    const wrapped = applyMiddleware(routes, (next) => (req, srv) => {
      calls.push(`${req.method} ${new URL(req.url).pathname}`);
      return next(req, srv);
    });

    const s = Bun.serve({ port: 0, routes: wrapped, fetch: fallback });
    await fetch(`${s.url.origin}/api/uploads`);
    s.stop(true);

    expect(calls).toEqual(["GET /api/uploads"]);
  });
});
