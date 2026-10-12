import type { Credentials } from "@shared/types";

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// Emails are compared case-insensitively in practice, so store them in one
// canonical form. Otherwise "Ada@example.com" and "ada@example.com" could
// register as two different accounts.
function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

// A deliberately simple check: something@something.something.
// Real validation of email addresses is famously hard; the only true test is
// sending a confirmation email.
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const MIN_PASSWORD_LENGTH = 8;

// Read { email, password } from an untrusted body, or null if the shape is wrong.
function parseEmailAndPassword(body: unknown): Credentials | null {
  if (typeof body !== "object" || body === null) return null;
  const { email, password } = body as Record<string, unknown>;

  if (typeof email !== "string" || typeof password !== "string") return null;

  const normalized = normalizeEmail(email);
  if (!looksLikeEmail(normalized) || password === "") return null;

  // The password is NOT trimmed: spaces are valid password characters.
  return { email: normalized, password };
}

// Registration enforces the password rules. (Week 8 adds a stronger policy.)
export function parseRegisterBody(body: unknown): Credentials | null {
  const credentials = parseEmailAndPassword(body);
  if (!credentials || credentials.password.length < MIN_PASSWORD_LENGTH) return null;
  return credentials;
}

// Login only checks the shape. Password rules belong to registration: if the
// rules become stricter later, existing users must still be able to log in.
export function parseLoginBody(body: unknown): Credentials | null {
  return parseEmailAndPassword(body);
}
