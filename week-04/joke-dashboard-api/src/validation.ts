// Runtime validation of request data (the pattern from week 2).
// Never trust the client: even our own front-end can be bypassed with curl.
import type { SaveJokeBody } from "@shared/types";

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function parseSaveJokeBody(body: unknown): SaveJokeBody | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  if (typeof b.externalId !== "number" || !Number.isInteger(b.externalId)) return null;
  if (typeof b.text !== "string" || typeof b.category !== "string") return null;

  const text = b.text.trim();
  const category = b.category.trim();
  if (!text || !category) return null;

  return { externalId: b.externalId, text, category };
}
