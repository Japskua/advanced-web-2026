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
 * One central error handler (in main.ts, through Bun.serve's `error` option)
 * turns it into a response. Code that is not about errors no longer needs
 * try/catch at all.
 */
import { fail } from "./util/response";

export class AppError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = new.target.name; // "NotFoundError", "ConflictError", …
    this.status = status;
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

// Bun.serve calls this for every error thrown by a handler.
export function errorHandler(error: Error): Response {
  if (error instanceof AppError) {
    return fail(error.message, error.status);
  }

  // Anything else is a bug or an outage. Log everything, reveal nothing.
  console.error("Unhandled error:", error);
  return fail("Internal server error", 500);
}
