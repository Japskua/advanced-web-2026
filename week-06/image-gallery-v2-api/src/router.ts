import type { BunRequest, Server } from "bun";
import {
  deleteUploadedImage,
  listUploads,
  resolveUploadPath,
  saveUploadedImage,
  UploadError,
} from "./services/upload-service";
import { etagMatches, notModified } from "./util/http-cache";
import { corsHeaders, fail, ok } from "./util/response";
import { isUuid } from "./util/validation";

// The router only translates between HTTP and the service: read the request,
// call the service, choose the status code. Compared with week 5, the handlers
// are the same apart from the new DELETE route and errorHandler at the end.

// GET /api/uploads
async function listUploadsHandler(): Promise<Response> {
  return ok(await listUploads());
}

// POST /api/uploads
async function uploadImageHandler(req: Request): Promise<Response> {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return fail("Expected a multipart/form-data body with an 'image' field.", 400);
  }

  const image = form.get("image");
  if (!(image instanceof File)) {
    return fail("Missing file field 'image'.", 400);
  }

  try {
    return ok(await saveUploadedImage(image), 201);
  } catch (error) {
    if (error instanceof UploadError) return fail(error.message, error.status);
    throw error;
  }
}

// DELETE /api/uploads/:id
async function deleteUploadHandler(req: BunRequest<"/api/uploads/:id">): Promise<Response> {
  const { id } = req.params;
  if (!isUuid(id)) return fail("Invalid upload id.", 400);

  const deleted = await deleteUploadedImage(id);
  if (!deleted) return fail("Upload not found.", 404);

  return ok(deleted);
}

// GET /uploads/:filename
async function serveUploadHandler(req: BunRequest<"/uploads/:filename">): Promise<Response> {
  const filePath = resolveUploadPath(req.params.filename);
  if (!filePath) return fail("Invalid file name.", 400);

  const file = Bun.file(filePath);
  if (!(await file.exists())) return fail("Not found.", 404);

  // Caching from week 5: the name is a UUID and the content never changes, so
  // the browser may keep the image for a year (immutable). The ETag (size +
  // modification time) answers a browser that asks anyway with 304.
  const caching = {
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: `"${file.size.toString(16)}-${file.lastModified.toString(16)}"`,
  };
  if (etagMatches(req, caching.ETag)) return notModified(caching);

  // Bun answers Range requests (206 Partial Content) for a Bun.file by itself.
  return new Response(file, {
    headers: { ...caching, "X-Content-Type-Options": "nosniff" },
  });
}

// GET /ws – upgrade to a WebSocket (week 5, see realtime.ts). After a
// successful upgrade there is no HTTP response to return.
function socketHandler(req: Request, server: Server<undefined>): Response | undefined {
  if (server.upgrade(req)) return undefined;
  return fail("Expected a WebSocket upgrade request.", 426);
}

export const routes = {
  "/api/uploads": {
    GET: listUploadsHandler,
    POST: uploadImageHandler,
  },
  "/api/uploads/:id": {
    DELETE: deleteUploadHandler,
  },
  "/uploads/:filename": {
    GET: serveUploadHandler,
  },
  "/ws": {
    GET: socketHandler,
  },
};

export function fallback(req: Request): Response {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  return fail("Not found", 404);
}

// Called by Bun when a handler throws (for example, the database is down).
// The details are logged on the server; the client gets a generic message.
export function errorHandler(error: Error): Response {
  console.error("Unhandled error:", error);
  return fail("Internal server error", 500);
}
