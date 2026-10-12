/**
 * A runnable tour of the TypeScript features used in this course.
 *
 *   bun run tour          (runs this file)
 *   bun run typecheck     (type-checks it together with the rest of the project)
 *
 * Lines marked with `// @ts-expect-error` contain a deliberate type error.
 * The comment tells tsc that the error is expected; delete the comment in your
 * editor to see the error message TypeScript gives.
 */
/* eslint-disable no-useless-assignment -- variables are reassigned only to demonstrate type errors */

// ---------------------------------------------------------------------------
// 1. Basic types and type inference
// ---------------------------------------------------------------------------
const courseName: string = "Advanced Web Applications";
const credits = 5; // inferred as `number`, no annotation needed
let isOnline = true; // inferred as `boolean`
isOnline = false;

// @ts-expect-error  a number cannot be assigned to a boolean variable
isOnline = 1;

console.log("1.", courseName, credits, isOnline);

// ---------------------------------------------------------------------------
// 2. Arrays and tuples
// ---------------------------------------------------------------------------
const weeks: number[] = [1, 2, 3];
const topics: Array<string> = ["TypeScript", "REST", "React"]; // same as string[]
const lecture: [number, string] = [1, "TypeScript & Bun"]; // a tuple: fixed length and types

console.log("2.", weeks.length, topics.join(", "), `week ${lecture[0]}: ${lecture[1]}`);

// ---------------------------------------------------------------------------
// 3. Object types: `type` alias vs `interface`
// ---------------------------------------------------------------------------
// Both describe object shapes. Interfaces can be extended and merged; type
// aliases can also name unions and other non-object types. In everyday code
// either is fine: pick one style and be consistent.
type Student = {
  readonly id: number; // cannot be changed after creation
  name: string;
  email?: string; // optional: may be missing (its type is string | undefined)
};

interface Teacher {
  name: string;
  courses: string[];
}

interface HeadTeacher extends Teacher {
  department: string;
}

const student: Student = { id: 1, name: "Aino" };
const head: HeadTeacher = { name: "Erkki", courses: [courseName], department: "Software Engineering" };

// @ts-expect-error  `id` is readonly
student.id = 2;

console.log("3.", student.name, student.email ?? "(no email)", head.department);

// ---------------------------------------------------------------------------
// 4. Union and literal types, and narrowing
// ---------------------------------------------------------------------------
type TaskStatus = "open" | "in progress" | "done";
type Id = number | string;

function describeId(id: Id): string {
  // `typeof` narrows the union: inside each branch TypeScript knows the exact type.
  if (typeof id === "number") {
    return `numeric id ${id.toFixed(0)}`;
  }
  return `string id ${id.toUpperCase()}`;
}

let status: TaskStatus = "open";
status = "done";

// @ts-expect-error  "finished" is not one of the allowed literals
status = "finished";

console.log("4.", describeId(42), describeId("abc"), status);

// ---------------------------------------------------------------------------
// 5. Functions: parameter types, return types, optional and default parameters
// ---------------------------------------------------------------------------
function greet(name: string, greeting: string = "Hello", punctuation?: string): string {
  return `${greeting}, ${name}${punctuation ?? "!"}`;
}

const add = (a: number, b: number): number => a + b; // arrow function

// @ts-expect-error  the second argument must be a number
add(1, "2");

console.log("5.", greet("Bun"), greet("Deno", "Goodbye", "."), add(2, 3));

// ---------------------------------------------------------------------------
// 6. Generics: types that take type parameters
// ---------------------------------------------------------------------------
// `T` is decided by the caller. The return type follows the argument type.
function firstItem<T>(items: T[]): T | undefined {
  return items[0];
}

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const taskResponse: ApiResponse<string[]> = { success: true, data: ["Learn TypeScript"] };

const firstWeek = firstItem(weeks); // number | undefined
const firstTopic = firstItem(topics); // string | undefined

console.log("6.", firstWeek, firstTopic, taskResponse.data?.length);

// ---------------------------------------------------------------------------
// 7. `any` vs `unknown`
// ---------------------------------------------------------------------------
// `any` switches the type checker off. `unknown` means "could be anything,
// prove what it is before using it". Data from outside your program (request
// bodies, JSON files, external APIs) should be treated as `unknown`.
const fromTheInternet: unknown = JSON.parse('{"title":"Buy milk"}');

// @ts-expect-error  cannot read properties of `unknown` without checking first
console.log("7.", "unchecked access works at runtime:", fromTheInternet.title);

if (typeof fromTheInternet === "object" && fromTheInternet !== null && "title" in fromTheInternet) {
  console.log("7.", "title is", fromTheInternet.title);
}

// ---------------------------------------------------------------------------
// 8. Type guards: functions that teach TypeScript about a type
// ---------------------------------------------------------------------------
// The return type `value is TaskStatus` means: if this returns true, the
// caller may treat `value` as a TaskStatus. Week 2 uses this for validation.
function isTaskStatus(value: unknown): value is TaskStatus {
  return value === "open" || value === "in progress" || value === "done";
}

const input: unknown = "in progress";
if (isTaskStatus(input)) {
  const checked: TaskStatus = input; // allowed, thanks to the guard
  console.log("8.", "valid status:", checked);
}

// ---------------------------------------------------------------------------
// 9. Utility types: deriving new types from existing ones
// ---------------------------------------------------------------------------
interface Task {
  readonly id: number;
  title: string;
  description: string;
  status: TaskStatus;
}

type NewTask = Omit<Task, "id" | "status">; // what a client sends when creating a task
type TaskPreview = Pick<Task, "id" | "title">; // a subset of the fields
type TaskUpdate = Partial<NewTask>; // every field optional
type TasksById = Record<number, Task>; // an object used as a dictionary

const draft: NewTask = { title: "Write docs", description: "Week 1 README" };
const preview: TaskPreview = { id: 1, title: draft.title };
const update: TaskUpdate = { description: "Updated" };
const index: TasksById = { 1: { id: 1, status: "open", ...draft } };

console.log("9.", preview, update, Object.keys(index));
