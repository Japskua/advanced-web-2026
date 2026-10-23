/**
 * Validation and sanitisation of request input.
 *
 * Last week every rule was a hand-written `if`. Elysia validates the *shape*
 * of the input for us: each route declares a schema for its body and path
 * parameters (`t` is Elysia's schema builder, based on TypeBox), and Elysia
 * rejects a request that does not match before the handler runs. The handler
 * also gets the body *typed*: no `unknown`, no casts.
 *
 * The `error` option is the message the client sees (errors.ts sends it as
 * `{ ok: false, error: { message } }`). Put it on the object *and* on each
 * field, so every way the input can be wrong gets the same message.
 *
 * What a schema cannot express stays code: trimming, lower-casing, and rules
 * whose message depends on the value (the password policy).
 */
import { t } from "elysia";
import type { CredentialsBody } from "@shared/types";
import { BadRequestError } from "./errors";

// ---------- shapes (checked by Elysia) ----------

const CREDENTIALS_REQUIRED = "Email and password are required.";

export const credentialsBody = t.Object(
  {
    email: t.String({ error: CREDENTIALS_REQUIRED }),
    password: t.String({ minLength: 1, error: CREDENTIALS_REQUIRED }),
  },
  { error: CREDENTIALS_REQUIRED },
);

const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 5000;
const NOTIFICATION_REQUIRED = "Title and content are required.";

export const createNotificationBody = t.Object(
  {
    title: t.String({ error: NOTIFICATION_REQUIRED }),
    content: t.String({ error: NOTIFICATION_REQUIRED }),
  },
  { error: NOTIFICATION_REQUIRED },
);

// Path parameters. Elysia checks the format before the handler runs.
export const userIdParams = t.Object({ id: t.String({ format: "uuid", error: "Invalid user id." }) });

// ---------- rules that stay code ----------

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

// Sanitise (trim, lower-case) and check the email format.
export function cleanCredentials({ email, password }: CredentialsBody): CredentialsBody {
  const normalized = email.trim().toLowerCase();
  if (!looksLikeEmail(normalized)) {
    throw new BadRequestError("Please provide a valid email address.");
  }
  return { email: normalized, password };
}

// Registration applies the password policy...
export function cleanRegistration(body: CredentialsBody): CredentialsBody {
  const credentials = cleanCredentials(body);
  const violations = passwordPolicyViolations(credentials.password);
  if (violations.length > 0) {
    throw new BadRequestError(`The password must contain ${violations.join(", ")}.`);
  }
  return credentials;
}
// ...login only uses cleanCredentials(). Applying the policy at login would
// tell an attacker the policy, and lock out users whose passwords predate a
// stricter policy.

export function cleanNotification(body: { title: string; content: string }) {
  const title = body.title.trim();
  const content = body.content.trim();
  if (!title || !content) {
    throw new BadRequestError("Title and content must not be empty.");
  }
  if (title.length > MAX_TITLE_LENGTH || content.length > MAX_CONTENT_LENGTH) {
    throw new BadRequestError(`The title may have at most ${MAX_TITLE_LENGTH} and the content ${MAX_CONTENT_LENGTH} characters.`);
  }
  return { title, content };
}
