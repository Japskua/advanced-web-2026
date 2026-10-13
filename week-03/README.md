# Week 3 – React

This week introduces **React**, the library used for every front-end from now
on. We build a small Habit Tracker that runs entirely in the browser (there is
no back-end this week) and learn the core ideas: components, props, state, and
how React re-renders when state changes.

The toolchain is still just Bun. Bun's built-in dev server bundles the
TypeScript and JSX, reloads the page as you edit, and builds an optimised
version for production. There is no Vite and no Node.js involved.

## Learning objectives

After this week you can:

- create a React + TypeScript project with Bun and run it with hot reloading
- write function components and pass data to them with typed **props**
- keep data in **state** with `useState` and update it immutably
- handle events and build a **controlled** form input
- render lists with stable `key`s and render content conditionally
- explain when `useMemo` is useful (optional topic)

## What you build

A daily habit tracker: a list of habits that can be marked done or undone, a
form to add new ones, and a progress bar showing how many are complete.

## Running it

```bash
cd week-03/habit-tracker
bun run dev        # http://localhost:5173, reloads on every save
bun run build      # production bundle in dist/
bun run typecheck
```

---

## 1. Creating a React project with Bun

```bash
mkdir habit-tracker && cd habit-tracker
bun init -y
bun add react react-dom
bun add -d @types/react @types/react-dom typescript@~6.0.3
```

Then create three things by hand:

1. **`index.html`** – the page. It references the stylesheet and the entry
   script; Bun's bundler follows those references.

   ```html
   <link rel="stylesheet" href="./src/styles.css" />
   ...
   <div id="root"></div>
   <script type="module" src="./src/main.tsx"></script>
   ```

2. **`src/main.tsx`** – mounts the React app into `<div id="root">`.
3. **`package.json` scripts**:

   ```json
   "scripts": {
     "dev": "bun --port=5173 ./index.html",
     "build": "bun build ./index.html --outdir=dist --production --public-path=/",
     "typecheck": "tsc --noEmit"
   }
   ```

Also adjust `tsconfig.json` for browser code: add `"DOM"` to `lib`, set
`"jsx": "react-jsx"` and `"types": []` (no Bun types in browser code). Compare
with this project's `tsconfig.json`.

> **About `bun init --react`.** Bun also has a ready-made React template. It
> creates a *full-stack* project in which one Bun server serves both an API and
> the React app. That is a good setup for a real project, but in this course
> the front-end and the back-end are separate projects (and from week 4 they
> talk to each other over HTTP), so we create the front-end by hand.

### What happens when you run `bun run dev`

```
bun ./index.html
   │
   ├─ reads index.html, finds ./src/main.tsx and ./src/styles.css
   ├─ transpiles TypeScript + JSX, bundles the imports (react, react-dom, …)
   ├─ serves the result on http://localhost:5173
   └─ watches the files: on save, the browser updates without a full reload
      (React Fast Refresh keeps component state where it can)
```

`bun run build` does the same bundling once, minifies the result and writes
plain static files to `dist/`. Those files can be hosted anywhere: any web
server can serve them (week 12 serves them with Caddy on a cloud server).

Note that `bun run dev` does **not** type-check, just like `bun run` on the
back-end. Your editor shows errors; `bun run typecheck` checks everything.

## 2. Project structure

```
week-03/habit-tracker/
├── index.html                 entry point for the bundler
├── src/
│   ├── main.tsx               mounts <App /> into #root
│   ├── App.tsx                state and logic of the app
│   ├── types.ts               the Habit type
│   ├── styles.css             global styles (linked from index.html)
│   └── components/
│       ├── HabitList.tsx      renders the list
│       ├── HabitItem.tsx      renders one habit
│       └── ProgressBar.tsx    renders the progress bar
├── package.json
└── tsconfig.json
```

## 3. Concepts

### Components and JSX

A component is a function that returns what should appear on the screen.
The HTML-like syntax is **JSX**; the bundler turns it into JavaScript function
calls.

```tsx
export default function HabitItem({ habit, onToggle }: Readonly<HabitItemProps>) {
  return (
    <li className="item">
      <span className={habit.completed ? "done" : ""}>{habit.name}</span>
      <button onClick={() => onToggle(habit.id)}>
        {habit.completed ? "Undo" : "Mark done"}
      </button>
    </li>
  );
}
```

- Component names start with a capital letter (`HabitItem`), so JSX can tell
  them apart from HTML tags (`li`).
- `{ ... }` embeds a JavaScript expression in JSX.
- `className` instead of `class`, `onClick` instead of `onclick`: JSX uses the
  DOM property names.

### Props: passing data down

Props are the arguments of a component. With TypeScript we declare their type,
and passing the wrong data becomes a compile error:

```tsx
interface HabitListProps {
  habits: Habit[];
  onToggle: (id: number) => void;
}

export default function HabitList({ habits, onToggle }: Readonly<HabitListProps>) { ... }
```

A component must never change its props (`Readonly<…>` documents that). Data
flows **down** from parent to child as props; events flow **up** when a child
calls a function it received as a prop. That is why `onToggle` is passed from
`App` through `HabitList` to `HabitItem`: the state lives in `App`, so only
`App` can change it.

### State: data that changes

```tsx
const [habits, setHabits] = useState<Habit[]>(INITIAL_HABITS);
```

`useState` returns the current value and a setter. Calling the setter schedules
a re-render: React calls the component function again, and this time `habits`
has the new value. A normal variable would not work, because it is recreated
from scratch on every render.

### Updating state immutably

This is the most important pattern of the week:

```tsx
const toggleHabit = (id: number) => {
  setHabits((prev) =>
    prev.map((habit) => (habit.id === id ? { ...habit, completed: !habit.completed } : habit)),
  );
};
```

- React compares old and new state **by reference**. If you mutate the
  existing array (`habits[0].completed = true; setHabits(habits)`), the
  reference does not change and React may skip the re-render.
- So we create a **new array** with `map`, and a **new object** for the habit
  that changed with the spread syntax `{ ...habit, completed: … }`. Unchanged
  habits are reused as they are.
- Passing a function to the setter (`prev => …`) gives you the latest state,
  even when several updates happen before the next render.

The same idea for adding (`[...prev, newItem]`) and removing
(`prev.filter(item => item.id !== id)`).

### Events and controlled inputs

```tsx
const [newHabit, setNewHabit] = useState("");

<form onSubmit={addHabit}>
  <input value={newHabit} onChange={(e) => setNewHabit(e.target.value)} />
</form>
```

The input is **controlled**: its value always comes from state, and every
keystroke updates the state. React is the single source of truth, so clearing
the field after submitting is just `setNewHabit("")`.

```tsx
const addHabit = (e: SubmitEvent<HTMLFormElement>) => {
  e.preventDefault(); // otherwise the browser reloads the page
  ...
};
```

`SubmitEvent` is React's type for form submit events (import it from
`"react"`). Older tutorials use `FormEvent`, which is deprecated in current
React type definitions.

### Lists and keys

```tsx
{habits.map((habit) => (
  <HabitItem key={habit.id} habit={habit} onToggle={onToggle} />
))}
```

Each element in a list needs a `key` that is unique among its siblings and
stable across renders. React uses it to match elements between renders. Use an
id from the data; the array index breaks as soon as items are reordered or
removed.

### Conditional rendering

```tsx
if (habits.length === 0) {
  return <p className="empty">No habits yet.</p>;
}
```

Inside JSX, use the ternary operator (`cond ? <A /> : <B />`) or `&&`
(`cond && <A />`).

### Optional: `useMemo`

```tsx
const completedCount = useMemo(
  () => habits.filter((habit) => habit.completed).length,
  [habits],
);
```

Every line in a component body runs on every render; typing one letter in the
input re-renders `App`. `useMemo` caches a calculated value and recomputes it
only when a value in the **dependency array** changes. For a cheap calculation
like this the benefit is negligible. The goal is to learn the dependency-array
idea, which comes back with `useEffect` in week 4.

`ProgressBar` shows the other option: the percentage is calculated directly in
the component body, which is the right default for cheap derived values.

## 4. Lecture walkthrough

1. Create the project (section 1). Delete what you do not need, write a
   minimal `App` that renders a heading, and run `bun run dev`.
2. Add the `habits` state and render the list directly in `App`. Then extract
   `HabitItem` and `HabitList` and introduce props.
3. Implement `toggleHabit`. Show what goes wrong with mutation, then fix it with
   `map` + spread.
4. Add the form: controlled input, `addHabit`, `preventDefault`.
5. *Optional:* add `ProgressBar` and the `useMemo` calculation. If you skip it,
   remove the component and show the completed count as plain text.
6. Run `bun run build` and look at `dist/`: one HTML file, one JS bundle, one
   CSS file.

**Tip:** install the React Developer Tools browser extension. Its Components
tab shows the component tree with each component's props and state.

## Compared with last year's Vite + Deno version

| Vite + Deno | Bun |
| ----------- | --- |
| `deno init --npm vite` (React + TypeScript template) | `bun init` + `bun add react react-dom` |
| `vite.config.ts` | not needed |
| `tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json` | one `tsconfig.json` |
| `deno task dev` (Vite dev server) | `bun run dev` (Bun dev server) |
| `deno task build` (`tsc -b && vite build`) | `bun run build` (+ `bun run typecheck`) |
| `import "./index.css"` in `main.tsx` | `<link rel="stylesheet">` in `index.html` |
| `React.SubmitEvent` | `SubmitEvent` imported from `"react"` (same type) |

Why the stylesheet moved: TypeScript 6 checks that every imported file exists
as a module, and a `.css` file is not one. Linking it from `index.html` is the
natural place in Bun's HTML-first bundling and needs no extra type
declarations. (Importing CSS from TypeScript also works if you add a
`declare module "*.css";` declaration file.)

## Exercises

1. Add a delete button to each habit. Which component owns the delete logic?
2. Show the number of remaining habits in the page title (hint: compute it,
   do not store it in state).
3. Prevent adding a habit whose name already exists (case-insensitive) and
   show a message under the form.
4. Add a filter (All / Open / Done) above the list. Is the selected filter
   state? Is the filtered list state?

## Further reading

- [react.dev: Thinking in React](https://react.dev/learn/thinking-in-react)
- [react.dev: Updating arrays in state](https://react.dev/learn/updating-arrays-in-state)
- [react.dev: Rendering lists](https://react.dev/learn/rendering-lists)
- [react.dev: useMemo](https://react.dev/reference/react/useMemo)
- [Bun: HTML & static sites (the dev server and bundler)](https://bun.sh/docs/bundler/html-static)
