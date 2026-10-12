// Settings in one place. Paths are resolved from this file's folder, so the
// server works no matter which directory it is started from.
//
// UPLOADS_DIR and DATA_DIR can be overridden with environment variables. The
// tests use that to work in a temporary folder.
import path from "node:path";

const PROJECT_ROOT = path.resolve(import.meta.dir, "..");

export const PORT = 8000;

// Where the image files are written.
export const UPLOADS_DIR = Bun.env.UPLOADS_DIR ?? path.join(PROJECT_ROOT, "uploads");

// Where the JSON "database" with the image metadata is written.
export const DATA_DIR = Bun.env.DATA_DIR ?? path.join(PROJECT_ROOT, "data");

// Bun rejects request bodies larger than this before our code even runs.
// It is a little above the 5 MB file limit, to leave room for the rest of the
// multipart body.
export const MAX_REQUEST_BYTES = 6 * 1024 * 1024;
