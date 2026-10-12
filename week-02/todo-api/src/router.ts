import type { BunRequest } from "bun";
import { serveStatic } from "./static";
import type { ApiResult, Task } from "./types";
import { parseCreateTaskBody, parseTaskId, parseUpdateTaskBody, readJson } from "./validation";

// ---------------------------------------------------------------------------
// In-memory "database"
// ---------------------------------------------------------------------------
// The data disappears when the server restarts. Week 5 saves it to a file and
// week 6 to a real database.
let nextId = 1;
const tasks: Task[] = [];

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------
// Every API response uses the same envelope (see ApiResult in types.ts), so
// the client can always check `payload.ok` first.
//
// The status code tells the client what happened. The ones used this week:
//   200 OK          request succeeded, the body has the result
//   201 Created     a new resource was created (POST)
//   204 No Content  succeeded, nothing to send back (DELETE)
//   400 Bad Request the client sent invalid data
//   404 Not Found   no such resource or route
// Reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status
//
// Week 5 moves these helpers to their own module.

function ok<T>(data: T, status = 200): Response {
  const body: ApiResult<T> = { ok: true, data };
  return Response.json(body, { status });
}

function fail(message: string, status: number): Response {
  const body: ApiResult<never> = { ok: false, error: { message } };
  return Response.json(body, { status });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
// One function per endpoint. `BunRequest<"/api/tasks/:id">` is a Request whose
// `params` object is typed from the route path, so `req.params.id` is a string
// and a typo such as `req.params.idd` is a compile error.

// GET /api/tasks
function listTasks(): Response {
  return ok(tasks);
}

// POST /api/tasks
async function createTask(req: Request): Promise<Response> {
  const body = parseCreateTaskBody(await readJson(req));
  if (!body) {
    return fail("Invalid body. Expected { title: string, description: string }", 400);
  }

  const task: Task = {
    id: nextId++,
    title: body.title,
    description: body.description,
    status: "open",
  };
  tasks.push(task);

  return ok(task, 201);
}

// GET /api/tasks/:id
function getTask(req: BunRequest<"/api/tasks/:id">): Response {
  const id = parseTaskId(req.params.id);
  if (id === null) return fail("Task id must be a positive integer", 400);

  const task = tasks.find((t) => t.id === id);
  if (!task) return fail("Task not found", 404);

  return ok(task);
}

// PUT /api/tasks/:id
async function updateTask(req: BunRequest<"/api/tasks/:id">): Promise<Response> {
  const id = parseTaskId(req.params.id);
  if (id === null) return fail("Task id must be a positive integer", 400);

  const body = parseUpdateTaskBody(await readJson(req));
  if (!body) {
    return fail(
      "Invalid body. Expected { title: string, description: string, status: 'open' | 'in progress' | 'done' }",
      400,
    );
  }

  const task = tasks.find((t) => t.id === id);
  if (!task) return fail("Task not found", 404);

  task.title = body.title;
  task.description = body.description;
  task.status = body.status;

  return ok(task);
}

// DELETE /api/tasks/:id
function deleteTask(req: BunRequest<"/api/tasks/:id">): Response {
  const id = parseTaskId(req.params.id);
  if (id === null) return fail("Task id must be a positive integer", 400);

  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return fail("Task not found", 404);

  tasks.splice(index, 1);
  return new Response(null, { status: 204 });
}

// ---------------------------------------------------------------------------
// Route table
// ---------------------------------------------------------------------------
// Bun matches the path, then picks the handler for the request's HTTP method.
// `:id` is a route parameter: "/api/tasks/7" matches with req.params.id === "7".
//
// This is the whole REST API for a "task" resource:
//
//   GET    /api/tasks      list all tasks
//   POST   /api/tasks      create a task
//   GET    /api/tasks/:id  read one task
//   PUT    /api/tasks/:id  replace one task's fields
//   DELETE /api/tasks/:id  delete one task
export const routes = {
  "/api/tasks": {
    GET: listTasks,
    POST: createTask,
  },
  "/api/tasks/:id": {
    GET: getTask,
    PUT: updateTask,
    DELETE: deleteTask,
  },
};

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------
// Bun calls this for every request that no route matched, including a known
// path with an unsupported method (for example PATCH /api/tasks).
export async function fallback(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);

  if (pathname.startsWith("/api/")) {
    return fail(`No route for ${req.method} ${pathname}`, 404);
  }

  if (req.method === "GET") {
    const file = await serveStatic(pathname);
    if (file) return file;
  }

  return new Response("Not Found", { status: 404 });
}
