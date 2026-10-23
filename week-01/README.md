# Week 1 – TypeScript & Bun introduction

This week sets up the tools for the whole course and builds the smallest
possible back-end: a JSON API with one endpoint, `GET /tasks`. There is no
front-end yet. The real subject is **TypeScript**: types, interfaces, unions,
generics and optional properties all show up in about 60 lines of code.

## Learning objectives

After this week you can:

- install Bun and create a TypeScript project with `bun init`
- explain what Bun is: a JavaScript runtime, package manager, bundler and test runner in one program
- write type aliases, interfaces, union types, optional and readonly properties, and generic types
- start an HTTP server with `Bun.serve` and return JSON from it
- tell the difference between *running* TypeScript (Bun) and *type-checking* it (`tsc`)
- write and run a first automated test with `bun test`

## What you build

```
GET http://localhost:8000/tasks

{
  "success": true,
  "statusCode": 200,
  "data": [
    { "id": 1, "title": "Learn TypeScript", "description": "Learn TypeScript basics", "status": "in progress" },
    { "id": 2, "title": "Build a Todo App", "description": "Build a simple todo app using Bun", "status": "open" }
  ]
}
```

Any other request gets a `404` with `{ "success": false, "statusCode": 404, "error": "Not Found" }`.

---

## 1. Installing Bun

Bun is a single executable. Install it with the official script:

| OS | Command |
| -- | ------- |
| macOS / Linux / WSL | `curl -fsSL https://bun.sh/install \| bash` |
| Windows (PowerShell) | `powershell -c "irm bun.sh/install.ps1 \| iex"` |
| macOS with Homebrew | `brew install oven-sh/bun/bun` |

Open a **new** terminal (so the updated `PATH` is picked up) and check:

```bash
bun --version
```

The course requires Bun 1.4.4 or newer; `bun upgrade` updates an existing
installation.

**Editor.** In VS Code, install the official
[Bun extension](https://marketplace.visualstudio.com/items?itemName=oven.bun-vscode)
(`oven.bun-vscode`). The repository's `.vscode/extensions.json` recommends it
automatically. TypeScript support itself is built into VS Code.

**Working from this repository.** If you cloned the course repository, run
`bun install` once in its root folder. That installs the dependencies of every
week. See [docs/setup.md](../docs/setup.md) for the full setup.

## 2. What is Bun?

Bun is one program that replaces several tools:

| Job | Bun command | What you would use otherwise |
| --- | ----------- | ---------------------------- |
| Run JavaScript/TypeScript | `bun file.ts` | Node.js + `tsx`/`ts-node`, or Deno |
| Install packages | `bun install`, `bun add` | npm, pnpm, yarn |
| Run `package.json` scripts | `bun run dev` | `npm run dev` |
| Bundle front-end code | `bun build`, `bun ./index.html` | Vite, webpack, esbuild |
| Run tests | `bun test` | Jest, Vitest |

It runs TypeScript files directly: no compile step, no configuration. It also
implements the **Web standard APIs** (`fetch`, `Request`, `Response`, `URL`,
`crypto`, `FormData`, …), so most of what you learn here also works in the
browser and in other runtimes.

Bun installs packages from the normal npm registry, so the whole npm ecosystem
(React, Tailwind CSS, `jose`, …) is available.

## 3. Creating the project

```bash
mkdir todo-api && cd todo-api
bun init -y
```

`bun init` creates:

| File | Purpose |
| ---- | ------- |
| `package.json` | Project name, scripts and dependencies |
| `tsconfig.json` | TypeScript settings used by your editor and by `tsc` |
| `index.ts` | A hello-world entry point (we delete it and use `src/main.ts`) |
| `bun.lock` | Exact versions of every installed package; commit it |
| `.gitignore`, `README.md` | The usual (newer versions may also add a `CLAUDE.md` with notes for AI assistants; you may delete it) |
| `node_modules/` | Installed packages, including `@types/bun` (type definitions for Bun's APIs) |

Then edit `package.json` so it has scripts and pins TypeScript:

```json
{
  "name": "week-01-todo-api",
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/main.ts",
    "start": "bun src/main.ts",
    "tour": "bun examples/typescript-tour.ts",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "devDependencies": {
    "@types/bun": "^1.4.2",
    "typescript": "~6.0.3"
  }
}
```

- `"type": "module"` means the project uses standard `import`/`export` syntax.
- `bun --watch` restarts the server whenever you save a file.
- `typescript` is pinned to 6.0 because the course's lint tooling does not
  support TypeScript 7 yet. Install it with `bun add -d typescript@~6.0.3`.

## 4. Project structure

```
week-01/todo-api/
├── package.json
├── tsconfig.json
├── src/
│   ├── task.ts        the Task type: interface, union type, readonly
│   ├── response.ts    the generic ApiResponse<T> type and jsonResponse()
│   └── main.ts        the request handler and the server
├── tests/
│   └── main.test.ts   automated tests for the handler
└── examples/
    └── typescript-tour.ts   runnable tour of TypeScript features (bun run tour)
```

## 5. Walkthrough

Build the files in this order. Each step introduces one group of TypeScript
concepts.

### Step 1 – `src/task.ts`: describing data with types

```ts
export type TaskStatus = "open" | "in progress" | "done";

export interface Task {
  readonly id: number;
  title: string;
  description: string;
  status: TaskStatus;
}
```

- `TaskStatus` is a **union of string literal types**. A variable of this type
  can hold exactly one of the three strings; `"finished"` is a compile error.
  This is much safer than `status: string`.
- `Task` is an **interface**: it describes the shape of an object.
- `readonly id` cannot be reassigned after the object is created. Identifiers
  should never change.

### Step 2 – `src/response.ts`: generics and optional properties

```ts
export type ApiResponse<T> = {
  success: boolean;
  statusCode: number;
  data?: T;
  error?: string;
};
```

- `ApiResponse<T>` is a **generic type**. `T` is a type parameter, filled in
  when the type is used: `ApiResponse<Task[]>` has `data?: Task[]`,
  `ApiResponse<null>` has `data?: null`. One definition serves every endpoint.
- `?` marks an **optional property**: `data` exists on success, `error` on
  failure. (Nothing stops someone from writing `{ success: true, error: "x" }`
  with this type. Week 2 fixes that with a *discriminated union*.)

`jsonResponse` turns the payload into an HTTP response:

```ts
export function jsonResponse<T>(payload: ApiResponse<T>): Response {
  return new Response(JSON.stringify(payload), {
    status: payload.statusCode,
    headers: { "Content-Type": "application/json" },
  });
}
```

`Response` is a Web standard class; nothing is imported. The body must be a
string (or bytes), so the object goes through `JSON.stringify`, and the
`Content-Type` header tells the client to parse it as JSON. (There is also a
shorthand, `Response.json(payload, { status })`, which we use from week 2.)

### Step 3 – `src/main.ts`: the server

```ts
export function handler(req: Request): Response {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/tasks") {
    const response: ApiResponse<Task[]> = { success: true, statusCode: 200, data: tasks };
    return jsonResponse(response);
  }

  const response: ApiResponse<null> = { success: false, statusCode: 404, error: "Not Found" };
  return jsonResponse(response);
}

if (import.meta.main) {
  const server = Bun.serve({ port: PORT, fetch: handler });
  console.log(`${APP_NAME} running at ${server.url}`);
}
```

How a request flows:

```
browser / curl ──HTTP──▶ Bun.serve ──Request──▶ handler(req) ──Response──▶ Bun.serve ──HTTP──▶ client
```

- `Bun.serve` opens a port and calls `fetch` (our `handler`) for **every**
  request. Whatever the handler returns is sent back.
- `new URL(req.url)` parses the full URL so we can read `pathname` (and later
  query parameters).
- Routing here is two `if` checks on the method and the path. Week 2 replaces
  them with Bun's declarative `routes` table.
- `import.meta.main` is `true` only when the file is executed directly. The
  tests import `handler` from this file, and this check stops them from also
  starting a server.

### Step 4 – Run it

```bash
bun run dev
```

Open <http://localhost:8000/tasks> in a browser, or use `curl`:

```bash
curl http://localhost:8000/tasks
curl -i http://localhost:8000/something-else    # -i shows the status line and headers
```

A graphical HTTP client is handy for the rest of the course:
[Bruno](https://www.usebruno.com/) (open source, stores requests as files) or
[Postman](https://www.postman.com/). VS Code users can also try the
[REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)
extension.

Edit a task title in `main.ts` and save: `--watch` restarts the server and the
next request shows the change. (The in-memory array is rebuilt on every restart.
That is fine for now; week 5 stores data in a file and week 6 in a database.)

### Step 5 – Type-check

> **Bun runs TypeScript, but it does not check the types.** It removes the type
> annotations and executes the JavaScript that remains. A type error will not
> stop `bun run dev`.

Your editor shows type errors as you type. To check the whole project from the
command line (and in CI), run the TypeScript compiler:

```bash
bun run typecheck      # runs: tsc --noEmit
```

Try it: change a task's status to `"finished"` in `main.ts`. The server still
starts, but `bun run typecheck` reports:

```
src/main.ts: error TS2322: Type '"finished"' is not assignable to type 'TaskStatus'.
```

### Step 6 – A first automated test

`tests/main.test.ts` calls the handler directly with a `Request` object, so no
server or port is involved:

```ts
import { expect, test } from "bun:test";
import { handler } from "../src/main";

test("returns the task list", async () => {
  const res = handler(new Request("http://localhost/tasks"));
  expect(res.status).toBe(200);
});
```

```bash
bun test
```

`bun test` finds every `*.test.ts` file automatically. The API is the same as
Jest's (`describe`, `test`, `expect`), so tutorials for Jest apply.

### Step 7 – The TypeScript tour

`examples/typescript-tour.ts` walks through every TypeScript feature used in the
course, with short explanations: inference, arrays and tuples, `type` vs
`interface`, unions and narrowing, functions, generics, `unknown` vs `any`, type
guards and utility types (`Omit`, `Pick`, `Partial`, `Record`).

```bash
bun run tour
```

Lines marked `// @ts-expect-error` contain deliberate type errors. Delete the
comment in your editor to see what TypeScript says.

---

## TypeScript reference for this week

| Concept | Example | Notes |
| ------- | ------- | ----- |
| Type annotation | `const PORT: number = 8000` | Optional when the type can be inferred |
| Type inference | `const port = 8000` | TypeScript infers `number` |
| Type alias | `type Id = number \| string` | Names any type, including unions |
| Interface | `interface Task { title: string }` | Names an object shape; can `extends` |
| Union type | `"open" \| "done"` | One of several types |
| Optional property | `data?: T` | Type becomes `T \| undefined` |
| Readonly property | `readonly id: number` | Cannot be reassigned |
| Generic type | `ApiResponse<T>` | A type with a type parameter |
| Generic function | `function first<T>(xs: T[]): T \| undefined` | `T` is inferred from the argument |
| Type-only import | `import type { Task } from "./task"` | Removed completely when the code runs |

## Bun compared with last year's Deno version

If you saw the Deno version of this course:

| Deno | Bun |
| ---- | --- |
| `deno init` | `bun init` |
| `deno.json` tasks | `package.json` scripts |
| `deno task dev` | `bun run dev` |
| `deno run --watch --allow-net src/main.ts` | `bun --watch src/main.ts` |
| `Deno.serve({ port }, handler)` | `Bun.serve({ port, fetch: handler })` |
| Imports end in `.ts` | Extension optional (`./task` or `./task.ts`) |
| Type-checks on `deno check` / `deno run --check` | `tsc --noEmit` |

The biggest conceptual difference is **permissions**. Deno refuses network,
file and environment access unless you pass `--allow-*` flags. Bun, like
Node.js, runs with the full permissions of your user account. Week 11 discusses
what that means for security and what protects a Bun application instead. The
full mapping is in [docs/deno-to-bun.md](../docs/deno-to-bun.md).

## Exercises

1. Add `GET /tasks/:id`, for example `/tasks/1`, that returns one task, or a 404
   if it does not exist. (Hint: `url.pathname.split("/")`.) Week 2 shows a
   cleaner way.
2. Add an optional `dueDate?: string` to `Task` and give one task a due date.
   Which other code has to change? Which does not?
3. Add `GET /tasks?status=open` that filters by status. Read the parameter with
   `url.searchParams.get("status")`. What should happen for an invalid status?
4. Write a test for each new endpoint.

## Further reading

- [Bun documentation](https://bun.sh/docs) – especially *Runtime → HTTP server*
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) – *Everyday Types* and *Generics*
- [MDN: Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) and [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response)
- [MDN: HTTP overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview)
