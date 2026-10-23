/**
 * The central error handler, as an Elysia plugin (week 8 has the full story).
 *
 * This API has few errors of its own: a failed login is not an error response
 * but a redirect back to the client (routes.ts), and "not signed in" is a
 * plain 401 from GET /api/me. What is left are the errors Elysia raises
 * itself, and bugs.
 */
import { Elysia } from "elysia";
import { fail } from "./util/response";

export const errorHandler = new Elysia({ name: "error-handler" }).onError({ as: "global" }, ({ code, error, set }) => {
  switch (code) {
    case "NOT_FOUND":
      set.status = 404;
      return fail("Not found");
    case "VALIDATION":
    case "PARSE":
      set.status = 400;
      return fail("Invalid request.");
  }

  // Anything else is a bug or an outage. Log everything, reveal nothing.
  console.error("Unhandled error:", error);
  set.status = 500;
  return fail("Internal server error");
});
