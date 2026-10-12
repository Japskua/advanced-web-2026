/**
 * The service layer: the application's rules for images.
 *
 * Compared with week 5, the files still go to disk, but the metadata now goes
 * through the repository to PostgreSQL. The service decides *what* happens
 * (validate, choose a file name, store the file, record it); the repository
 * decides *how* it is stored.
 *
 *   router  →  service  →  repository  →  database
 *   (HTTP)     (rules)     (SQL)
 */
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type { UploadRecord } from "@shared/types";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  isAllowedImageType,
  type AllowedImageType,
} from "@shared/upload-rules";
import { UPLOADS_DIR } from "../config";
import * as uploadRepository from "../repositories/upload-repository";

// Errors caused by the request. The router maps them to their status code.
export class UploadError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "UploadError";
    this.status = status;
  }
}

export async function ensureStorage(): Promise<void> {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

// The "magic bytes" check from week 5.
function detectImageType(bytes: Uint8Array): AllowedImageType | null {
  const startsWith = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));

  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export function listUploads(): Promise<UploadRecord[]> {
  return uploadRepository.listUploads();
}

export async function saveUploadedImage(file: File): Promise<UploadRecord> {
  if (file.size === 0) {
    throw new UploadError("The file is empty.", 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(`The file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`, 413);
  }
  if (!isAllowedImageType(file.type)) {
    throw new UploadError("Only PNG, JPEG, WebP and GIF images are supported.", 415);
  }
  const header = new Uint8Array(await file.arrayBuffer()).subarray(0, 12); // the first 12 bytes
  if (detectImageType(header) !== file.type) {
    throw new UploadError("The file content does not match its image type.", 415);
  }

  const id = crypto.randomUUID();
  const filename = `${id}.${ALLOWED_IMAGE_TYPES[file.type]}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  await Bun.write(filePath, file);

  try {
    return await uploadRepository.insertUpload({
      id,
      filename,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
    });
  } catch (error) {
    // The metadata could not be saved, so nobody can ever find this file.
    // Remove it instead of leaving an orphan on disk.
    await rm(filePath, { force: true });
    throw error;
  }
}

/**
 * Delete an image: first the database row, then the file.
 *
 * Why this order? The database is the source of truth: once the row is gone,
 * the image has disappeared from the gallery. If deleting the file then fails,
 * an unused file remains on disk, which is harmless. The other order could
 * leave a gallery entry whose image no longer exists.
 */
export async function deleteUploadedImage(id: string): Promise<UploadRecord | null> {
  const deleted = await uploadRepository.deleteUploadById(id);
  if (!deleted) return null;

  // force: true = do not fail if the file is already gone.
  await rm(path.join(UPLOADS_DIR, deleted.filename), { force: true });
  return deleted;
}

export function resolveUploadPath(filename: string): string | null {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp|gif)$/.test(filename)) return null;
  return path.join(UPLOADS_DIR, filename);
}
