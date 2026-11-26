/**
 * Conditional requests (HTTP caching).
 *
 * The server labels a response with a validator, the ETag ("entity tag"):
 *
 *     ETag: "44-19a8f3c2b10"
 *
 * The browser keeps the response in its cache. The next time it needs the
 * same URL it asks "has it changed?" by sending the tag back:
 *
 *     If-None-Match: "44-19a8f3c2b10"
 *
 * If the tag still matches, the server answers 304 Not Modified with no body,
 * and the browser uses its cached copy. Same result for the page, but no bytes
 * of the image (or the JSON) travel again.
 */

// Removes the weak prefix: W/"abc" and "abc" name the same version for
// If-None-Match (RFC 9110 calls this the weak comparison).
function opaque(tag: string): string {
  return tag.trim().replace(/^W\//, "");
}

// True when the request's If-None-Match header names this ETag. The header can
// hold a list ("a", "b") or *, which matches any current version.
export function etagMatches(req: Request, etag: string): boolean {
  const header = req.headers.get("If-None-Match");
  if (!header) return false;
  if (header.trim() === "*") return true;
  return header.split(",").some((tag) => opaque(tag) === opaque(etag));
}

// 304 Not Modified: no body, but the same validator and caching headers as the
// 200 it stands for, so the browser can update its cache entry.
export function notModified(headers: Record<string, string>): Response {
  return new Response(null, { status: 304, headers });
}
