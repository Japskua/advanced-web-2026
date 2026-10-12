import type { BunRequest } from "bun";
import { BadRequestError } from "../errors";
import { deleteFile, downloadFile, listFiles, uploadFile } from "../services/file-service";
import type { AuthUser } from "../types";
import { bytes, noContent, ok } from "../util/response";
import { parseUploadForm, parseUuid } from "../util/validation";

// GET /api/files
export async function list(_req: Request, user: AuthUser): Promise<Response> {
  return ok(await listFiles(user));
}

// POST /api/files – multipart/form-data with the encrypted bytes and metadata.
export async function upload(req: Request, user: AuthUser): Promise<Response> {
  const form = await req.formData().catch(() => null);
  if (!form) throw new BadRequestError("Expected a multipart/form-data body.");
  return ok(await uploadFile(user, parseUploadForm(form)), 201);
}

// GET /api/files/:id/content – the encrypted bytes.
export async function download(req: BunRequest<"/api/files/:id/content">, user: AuthUser): Promise<Response> {
  return bytes(await downloadFile(user, parseUuid(req.params.id, "file id")));
}

// DELETE /api/files/:id
export async function remove(req: BunRequest<"/api/files/:id">, user: AuthUser): Promise<Response> {
  await deleteFile(user, parseUuid(req.params.id, "file id"));
  return noContent();
}
