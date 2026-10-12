// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type TaskStatus = "open" | "in progress" | "done";

export interface Task {
  readonly id: number;
  title: string;
  description: string;
  status: TaskStatus;
}

// ---------------------------------------------------------------------------
// Request body types
// ---------------------------------------------------------------------------
// Utility types derive these from Task, so they stay in sync automatically.

// POST /api/tasks: the client sends a title and a description. The server
// decides the id and the initial status.
export type CreateTaskBody = Pick<Task, "title" | "description">;

// PUT /api/tasks/:id: the client sends every editable field. PUT means
// "replace the resource with this", so nothing is optional.
export type UpdateTaskBody = Omit<Task, "id">;

// ---------------------------------------------------------------------------
// Response envelope
// ---------------------------------------------------------------------------
// Week 1 used one type with optional fields: { success, data?, error? }.
// That type allows nonsense such as { success: true, error: "oops" }.
//
// A *discriminated union* fixes it. Both variants share the `ok` property, but
// with different literal types. When code checks `if (result.ok)`, TypeScript
// knows which variant it has, and only that variant's fields are accessible.

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { message: string } };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;
