import type { BunRequest } from "bun";
import { listUploads, resolveUploadPath, saveUploadedImage, UploadError } from "./services/upload-service";
import { corsHeaders, fail, ok } from "./util/response";

// GET /api/uploads – metadata of every image, newest first.
async function listUploadsHandler(): Promise<Response> {
  return ok(await listUploads());
}

// POST /api/uploads – upload one image as multipart/form-data, field "image".
//
// HTML forms and FormData send files as multipart/form-data: the body is split
// into parts, one per field, each with its own headers. req.formData() parses
// it; file fields come back as File objects (a File is a Blob with a name).
async function uploadImageHandler(req: Request): Promise<Response> {
  // formData() throws if the body is not multipart (or URL-encoded) form data.
  const form = await req.formData().catch(() => null);
  if (!form) {
    return fail("Expected a multipart/form-data body with an 'image' field.", 400);
  }

  const image = form.get("image");
  if (!(image instanceof File)) {
    return fail("Missing file field 'image'.", 400);
  }

  try {
    const record = await saveUploadedImage(image);
    return ok(record, 201);
  } catch (error) {
    if (error instanceof UploadError) {
      return fail(error.message, error.status);
    }
    throw error; // unexpected: let it become a 500 (and be logged)
  }
}

// GET /uploads/:filename – the image file itself.
async function serveUploadHandler(req: BunRequest<"/uploads/:filename">): Promise<Response> {
  const filePath = resolveUploadPath(req.params.filename);
  if (!filePath) return fail("Invalid file name.", 400);

  const file = Bun.file(filePath);
  if (!(await file.exists())) return fail("Not found.", 404);

  // Bun sets Content-Type from the extension. Two extra headers:
  // - nosniff: the browser must trust that Content-Type and never guess, so an
  //   upload can never be interpreted as HTML or JavaScript.
  // - Cache-Control: the name is a UUID and the content never changes, so the
  //   browser may keep the image for a year without asking again.
  return new Response(file, {
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export const routes = {
  "/api/uploads": {
    GET: listUploadsHandler,
    POST: uploadImageHandler,
  },
  "/uploads/:filename": {
    GET: serveUploadHandler,
  },
};

export function fallback(req: Request): Response {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  return fail("Not found", 404);
}
