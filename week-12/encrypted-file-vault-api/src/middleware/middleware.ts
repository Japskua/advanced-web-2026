/**
 * Middleware: a function that takes a handler and returns a new handler that
 * does something before and/or after calling the original.
 *
 *     const logged = withLogging(handler);   // same signature as handler
 *
 * Because the result is again a handler, middleware can be stacked:
 * withAuth(withLogging(handler)). Express, Hono, Koa and most other web
 * frameworks are built around this idea.
 *
 * Bun.serve has no built-in middleware system, so applyMiddleware() below
 * wraps every handler in a `routes` table for us.
 */
import type { Server } from "bun";

// A handler for any kind of request. `Req` is a type parameter so the same
// middleware works for plain Requests (the fetch fallback) and for Bun's typed
// route requests (BunRequest<"/api/uploads/:id">) without losing the types.
export type Handler<Req extends Request = Request> = (
  req: Req,
  server: Server<undefined>,
) => Response | Promise<Response>;

// A middleware is generic too: whatever request type goes in comes back out.
export type Middleware = <Req extends Request>(next: Handler<Req>) => Handler<Req>;

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

// The values Bun accepts in a routes table: a static Response, one handler for
// every method, or one handler per method.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each route has its own request type
type AnyHandler = Handler<any>;
type RouteValue = Response | AnyHandler | Partial<Record<HttpMethod, AnyHandler | Response>>;

// Wrap every handler of a routes table with the given middleware. The first
// middleware in the list is the outermost one. Static Responses are left
// alone: Bun sends them without running any code.
export function applyMiddleware<R extends Record<string, RouteValue>>(routes: R, ...middleware: Middleware[]): R {
  const wrap = (handler: AnyHandler): AnyHandler => middleware.reduceRight((next, mw) => mw(next), handler);

  const wrapped: Record<string, RouteValue> = {};
  for (const [path, value] of Object.entries(routes)) {
    if (value instanceof Response) {
      wrapped[path] = value;
    } else if (typeof value === "function") {
      wrapped[path] = wrap(value);
    } else {
      wrapped[path] = Object.fromEntries(
        Object.entries(value).map(([method, handler]) => [
          method,
          handler instanceof Response ? handler : wrap(handler),
        ]),
      );
    }
  }
  return wrapped as R;
}
