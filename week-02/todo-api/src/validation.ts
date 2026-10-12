/**
 * Validation of untrusted input.
 *
 * Anything that arrives over HTTP (the body, the URL, headers) is typed as
 * `unknown`: the client could have sent anything. These functions check the
 * data at runtime and return either a correctly typed value or `null`.
 *
 * TypeScript types disappear when the code runs, so they cannot protect the
 * server from bad input on their own. Runtime checks like these are what make
 * the types *true*.
 */
import type { CreateTaskBody, TaskStatus, UpdateTaskBody } from "./types";

export const TASK_STATUSES: readonly TaskStatus[] = ["open", "in progress", "done"];

// Read the request body as JSON. Invalid JSON returns null instead of throwing,
// so the handlers can answer with 400 Bad Request.
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// A type guard: when it returns true, TypeScript treats `value` as a TaskStatus.
export function isTaskStatus(value: unknown): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}

// Accept only a non-empty string, and return it trimmed.
function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// Narrow `unknown` to a plain object whose properties we can read.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCreateTaskBody(body: unknown): CreateTaskBody | null {
  if (!isRecord(body)) return null;

  const title = nonEmptyString(body.title);
  const description = nonEmptyString(body.description);
  if (title === null || description === null) return null;

  return { title, description };
}

export function parseUpdateTaskBody(body: unknown): UpdateTaskBody | null {
  if (!isRecord(body)) return null;

  const title = nonEmptyString(body.title);
  const description = nonEmptyString(body.description);
  if (title === null || description === null) return null;
  if (!isTaskStatus(body.status)) return null;

  return { title, description, status: body.status };
}

// Route parameters are always strings. A task id must be a positive whole
// number: "1.5", "-3", "abc" and "" are all rejected.
export function parseTaskId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}
