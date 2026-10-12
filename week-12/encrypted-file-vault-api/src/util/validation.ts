// Validation of request input (the week 8 approach: parse or throw BadRequestError).
import type { LoginBody, OnboardingBody, RegisterBody } from "@shared/types";
import { AES_GCM_IV_BYTES, MAX_FILE_BYTES } from "@shared/limits";
import { BadRequestError } from "../errors";

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new BadRequestError("The request body must be valid JSON.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestError("The request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}

function email(value: unknown): string {
  if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    throw new BadRequestError("Please provide a valid email address.");
  }
  return value.trim().toLowerCase();
}

function passwordPolicyViolations(password: string): string[] {
  const violations: string[] = [];
  if (password.length < 8) violations.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) violations.push("an uppercase letter");
  if (!/[a-z]/.test(password)) violations.push("a lowercase letter");
  if (!/[0-9]/.test(password)) violations.push("a number");
  if (!/[^A-Za-z0-9]/.test(password)) violations.push("a special character");
  return violations;
}

export function parseRegisterBody(body: Record<string, unknown>): RegisterBody {
  if (typeof body.password !== "string" || typeof body.inviteCode !== "string") {
    throw new BadRequestError("Email, password and invitation code are required.");
  }
  const violations = passwordPolicyViolations(body.password);
  if (violations.length > 0) {
    throw new BadRequestError(`The password must contain ${violations.join(", ")}.`);
  }
  return { email: email(body.email), password: body.password, inviteCode: body.inviteCode.trim() };
}

export function parseLoginBody(body: Record<string, unknown>): LoginBody {
  if (typeof body.password !== "string" || body.password === "") {
    throw new BadRequestError("Email and password are required.");
  }
  return { email: email(body.email), password: body.password };
}

const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

export function parseFingerprint(value: unknown): string {
  if (typeof value !== "string" || !FINGERPRINT_PATTERN.test(value)) {
    throw new BadRequestError("The key fingerprint must be a SHA-256 hash in hexadecimal (64 characters).");
  }
  return value;
}

export function parseOnboardingBody(body: Record<string, unknown>): OnboardingBody {
  return { keyFingerprint: parseFingerprint(body.keyFingerprint) };
}

export interface UploadInput {
  encrypted: File;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  encryptionIv: string;
  keyFingerprint: string;
}

// The multipart upload: the encrypted bytes plus the metadata needed to
// decrypt and display them later. The parameter type asks only for what the
// function uses (a `get` method), which any FormData implementation provides.
export function parseUploadForm(form: { get(name: string): unknown }): UploadInput {
  const encrypted = form.get("file");
  const text = (name: string) => {
    const value = form.get(name);
    if (typeof value !== "string" || value === "") throw new BadRequestError(`Missing form field '${name}'.`);
    return value;
  };

  if (!(encrypted instanceof File)) throw new BadRequestError("Missing file field 'file'.");

  const sizeBytes = Number(text("sizeBytes"));
  if (!Number.isInteger(sizeBytes) || sizeBytes < 0 || sizeBytes > MAX_FILE_BYTES) {
    throw new BadRequestError(`Files may be at most ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  }

  if (text("encryptionAlgorithm") !== "AES-GCM") {
    throw new BadRequestError("Only AES-GCM encryption is supported.");
  }

  const encryptionIv = text("encryptionIv");
  let ivLength = 0;
  try {
    ivLength = Uint8Array.fromBase64(encryptionIv).length;
  } catch {
    // reported below
  }
  if (ivLength !== AES_GCM_IV_BYTES) {
    throw new BadRequestError(`The IV must be ${AES_GCM_IV_BYTES} bytes, Base64-encoded.`);
  }

  return {
    encrypted,
    originalFilename: text("originalFilename").slice(0, 255),
    contentType: text("contentType").slice(0, 255),
    sizeBytes,
    encryptionIv,
    keyFingerprint: parseFingerprint(text("keyFingerprint")),
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseUuid(value: string, what: string): string {
  if (!UUID_PATTERN.test(value)) throw new BadRequestError(`Invalid ${what}.`);
  return value.toLowerCase();
}
