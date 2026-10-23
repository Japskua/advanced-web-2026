/**
 * Application errors.
 *
 * Until now every handler chose status codes itself, with try/catch blocks
 * around service calls. With a layered architecture that does not scale: the
 * service knows *what* went wrong (no such user, email taken) but should not
 * know about HTTP; the route knows HTTP but should not inspect every possible
 * failure.
 *
 * Instead, any layer throws an AppError subclass that carries its HTTP status.
 * One central error handler (the `errorHandler` plugin below, an Elysia
 * `onError` hook) turns it into a response. Code that is not about errors no
 * longer needs try/catch at all.
 */
import { Elysia } from "elysia";
import type { ApiResult } from "@shared/types";

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

function fail(message: string): ApiResult<never> {
  return { ok: false, error: { message } };
}

/**
 * Elysia calls onError for every error: our own AppErrors, and the errors
 * Elysia raises itself before a handler runs. `code` tells them apart:
 *
 *   VALIDATION  the body or a path parameter does not match its schema
 *               (the schema's `error` option is the message, see schemas.ts)
 *   PARSE       the body is not valid JSON
 *   NOT_FOUND   no route matches
 *
 * `as: "global"` applies the hook to every route of the app that uses this
 * plugin, not only to routes defined inside the plugin.
 */
export const errorHandler = new Elysia({ name: "error-handler" })
  .error({ AppError })
  .onError({ as: "global" }, ({ code, error, set }) => {
    if (error instanceof AppError) {
      set.status = error.status;
      return fail(error.message);
    }
    switch (code) {
      case "VALIDATION":
        set.status = 400;
        return fail(typeof error.customError === "string" ? error.customError : "Invalid request.");
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
