/**
 * Storing uploaded images.
 *
 * Common practice, also in this demo: the image *files* go to file storage
 * (here a folder on disk; in week 12 S3-compatible object storage), and only *metadata*
 * about them (name, size, type, time) goes to the "database". This week the
 * database is a JSON file, data/uploads.json; week 6 replaces it with
 * PostgreSQL.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { UploadRecord } from "@shared/types";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  isAllowedImageType,
  type AllowedImageType,
} from "@shared/upload-rules";
import { DATA_DIR, UPLOADS_DIR } from "../config";

const DB_PATH = path.join(DATA_DIR, "uploads.json");

// Errors caused by the uploaded file itself. The router turns them into 4xx
// responses; any other error is a bug and becomes a 500.
export class UploadError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "UploadError";
    this.status = status;
  }
}

// Create the folders once, at startup.
export async function ensureStorage(): Promise<void> {
  await mkdir(UPLOADS_DIR, { recursive: true });
  await mkdir(DATA_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// The JSON "database"
// ---------------------------------------------------------------------------
// Bun.file(path) is a lazy handle: nothing is read until we call .json(),
// .text(), .bytes() or .stream() on it.
async function readDb(): Promise<UploadRecord[]> {
  const file = Bun.file(DB_PATH);
  if (!(await file.exists())) return [];

  try {
    const parsed: unknown = await file.json();
    return Array.isArray(parsed) ? (parsed as UploadRecord[]) : [];
  } catch {
    return []; // a corrupted file is treated as empty
  }
}

// Bun.write(path, data) writes a string, bytes, a Blob or a File, creating
// missing folders, and replaces the file if it exists.
async function writeDb(records: UploadRecord[]): Promise<void> {
  await Bun.write(DB_PATH, JSON.stringify(records, null, 2));
}

// ---------------------------------------------------------------------------
// Checking what the file really is
// ---------------------------------------------------------------------------
// `file.type` is whatever the client claimed. Anyone can upload an HTML page or
// a script and call it "image/png". Image formats start with a fixed byte
// sequence (a "magic number"), so we check the first bytes as well.
function detectImageType(bytes: Uint8Array): AllowedImageType | null {
  const startsWith = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));

  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

// All uploads, newest first. Records are appended as they arrive, so the file
// is in chronological order and reversing it is enough (sorting by the
// timestamp would mix up two uploads from the same millisecond).
export async function listUploads(): Promise<UploadRecord[]> {
  const records = await readDb();
  return records.reverse();
}

/**
 * Validate an uploaded image, write it to UPLOADS_DIR under a new unique name,
 * and append its metadata to the JSON database.
 *
 * Note the status codes: 413 Content Too Large and 415 Unsupported Media Type
 * say more precisely than 400 what is wrong with the upload.
 */
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

  // Never use the client's file name on disk: it could contain "../", clash
  // with another upload, or be very long. A UUID is unique and safe.
  const id = crypto.randomUUID();
  const filename = `${id}.${ALLOWED_IMAGE_TYPES[file.type]}`;
  await Bun.write(path.join(UPLOADS_DIR, filename), file);

  const record: UploadRecord = {
    id,
    filename,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    url: `/uploads/${filename}`,
  };

  // Read-modify-write. If two uploads finish at the same moment, both can read
  // the same old list and the second write overwrites the first: one record is
  // lost. A database handles concurrent writes correctly (week 6).
  const records = await readDb();
  records.push(record);
  await writeDb(records);

  return record;
}

// Map a requested file name to a path in UPLOADS_DIR, or null if the name is
// not one we could have generated. This also rules out path traversal.
export function resolveUploadPath(filename: string): string | null {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp|gif)$/.test(filename)) return null;
  return path.join(UPLOADS_DIR, filename);
}
