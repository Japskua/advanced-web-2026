// A generic type: `T` is a placeholder that is filled in where the type is used.
// ApiResponse<Task[]> carries a list of tasks, ApiResponse<null> carries nothing.
//
// The `?` marks optional properties: a successful response has `data`,
// a failed one has `error`. (Week 2 shows a stricter way to model this.)
export type ApiResponse<T> = {
  success: boolean;
  statusCode: number;
  data?: T;
  error?: string;
};

// Turn an ApiResponse into an HTTP Response.
// `Request` and `Response` are standard Web APIs: the same classes exist in the
// browser, in Bun, in Deno and in Node.js, so nothing needs to be imported.
export function jsonResponse<T>(payload: ApiResponse<T>): Response {
  return new Response(JSON.stringify(payload), {
    status: payload.statusCode,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
