/**
 * Application errors.
 *
 * Until now every handler chose status codes itself, with try/catch blocks
 * around service calls. With a layered architecture that does not scale: the
 * service knows *what* went wrong (no such user, email taken) but should not
 * know about HTTP; the handler knows HTTP but should not inspect every possible
 * failure.
 *
 * Instead, any layer throws an AppError subclass that carries its HTTP status.
 * One central error handler (the `errorHandler` plugin below, an Elysia
 * `onError` hook) turns it into a response. Code that is not about errors no longer needs
 * try/catch at all.
 */
import { Elysia } from "elysia";
import type { ApiResult } from "@shared/types";

export class AppError extends Error {
  readonly status: number;
  readonly headers: Record<string, string>;

  constructor(status: number, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.name = new.target.name; // "NotFoundError", "ConflictError", …
    this.status = status;
    this.headers = headers;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request") {
    super(400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Not authenticated") {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(409, message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(retryAfterSeconds: number) {
    super(429, "Too many attempts. Try again later.", { "Retry-After": String(retryAfterSeconds) });
  }
}

function fail(message: string): ApiResult<never> {
  return { ok: false, error: { message } };
}

/**
 * Elysia calls onError for every error: our own AppErrors, and the errors
 * Elysia raises itself before a handler runs (week 8):
 *
 *   PARSE       the body is not valid JSON (or not valid multipart)
 *   NOT_FOUND   no route matches
 *
 * An AppError's headers (Retry-After on a 429) go into the response too.
 */
export const errorHandler = new Elysia({ name: "error-handler" })
  .error({ AppError })
  .onError({ as: "global" }, ({ code, error, set }) => {
    if (error instanceof AppError) {
      set.status = error.status;
      Object.assign(set.headers, error.headers);
      return fail(error.message);
    }
    switch (code) {
      case "PARSE":
        set.status = 400;
        return fail("The request body must be valid JSON.");
      case "NOT_FOUND":
        set.status = 404;
        return fail("Not found");
    }

    // Anything else is a bug or an outage. Log everything, reveal nothing.
    console.error("Unhandled error:", error);
    set.status = 500;
    return fail("Internal server error");
  });
