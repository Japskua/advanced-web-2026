/**
 * Validation and sanitisation of request input.
 *
 * Validation rejects input that breaks the rules; sanitisation turns acceptable
 * input into a canonical form (trimmed text, lower-cased email). Both happen
 * here, at the edge of the application, so services can trust their arguments.
 *
 * Each parser throws a BadRequestError with a message the user can act on.
 */
import type { CreateNotificationBody, CredentialsBody } from "@shared/types";
import { BadRequestError } from "../errors";

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new BadRequestError("The request body must be valid JSON.");
  }
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestError("The request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// The password policy. Returns what is missing, so the message can say exactly
// what to fix ("at least one number") instead of a generic "too weak".
export function passwordPolicyViolations(password: string): string[] {
  const violations: string[] = [];
  if (password.length < 8) violations.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) violations.push("an uppercase letter");
  if (!/[a-z]/.test(password)) violations.push("a lowercase letter");
  if (!/[0-9]/.test(password)) violations.push("a number");
  if (!/[^A-Za-z0-9]/.test(password)) violations.push("a special character");
  return violations;
}

function parseEmailAndPassword(body: unknown): CredentialsBody {
  const { email, password } = asRecord(body);
  if (typeof email !== "string" || typeof password !== "string" || password === "") {
    throw new BadRequestError("Email and password are required.");
  }

  const normalized = normalizeEmail(email);
  if (!looksLikeEmail(normalized)) {
    throw new BadRequestError("Please provide a valid email address.");
  }
  return { email: normalized, password };
}

// Registration applies the password policy...
export function parseRegisterBody(body: unknown): CredentialsBody {
  const credentials = parseEmailAndPassword(body);

  const violations = passwordPolicyViolations(credentials.password);
  if (violations.length > 0) {
    throw new BadRequestError(`The password must contain ${violations.join(", ")}.`);
  }
  return credentials;
}

// ...login does not. Applying the policy at login would tell an attacker the
// policy, and lock out users whose passwords predate a stricter policy.
export function parseLoginBody(body: unknown): CredentialsBody {
  return parseEmailAndPassword(body);
}

const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 5000;

export function parseCreateNotificationBody(body: unknown): CreateNotificationBody {
  const { title, content } = asRecord(body);
  if (typeof title !== "string" || typeof content !== "string") {
    throw new BadRequestError("Title and content are required.");
  }

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  if (!trimmedTitle || !trimmedContent) {
    throw new BadRequestError("Title and content must not be empty.");
  }
  if (trimmedTitle.length > MAX_TITLE_LENGTH || trimmedContent.length > MAX_CONTENT_LENGTH) {
    throw new BadRequestError(`The title may have at most ${MAX_TITLE_LENGTH} and the content ${MAX_CONTENT_LENGTH} characters.`);
  }
  return { title: trimmedTitle, content: trimmedContent };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseUuid(value: string, what: string): string {
  if (!UUID_PATTERN.test(value)) throw new BadRequestError(`Invalid ${what}.`);
  return value.toLowerCase();
}
