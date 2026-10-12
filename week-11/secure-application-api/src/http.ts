// Small helpers used by both versions. The CORS headers differ between the
// versions, so each passes its own.

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function json(data: unknown, status: number, headers: Record<string, string>): Response {
  return Response.json(data, { status, headers });
}
