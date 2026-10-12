import { useMemo, useState, type SubmitEvent } from "react";
import HabitList from "./components/HabitList";
import ProgressBar from "./components/ProgressBar";
import type { Habit } from "./types";

const INITIAL_HABITS: Habit[] = [
  { id: 1, name: "Drink water", completed: false },
  { id: 2, name: "Exercise", completed: false },
  { id: 3, name: "Read a book", completed: false },
];

export default function App() {
  // State: data that changes over time. When it changes, React re-renders the
  // component with the new value. useState returns the current value and a
  // setter function.
  const [habits, setHabits] = useState<Habit[]>(INITIAL_HABITS);

  // A "controlled input": the text field always shows this state value, and
  // every keystroke updates it.
  const [newHabit, setNewHabit] = useState("");

  /**
   * Updating state immutably — the single most important pattern this week.
   *
   * React decides whether to re-render by comparing the old and new state
   * *by reference*. Mutating the existing array (habits[0].completed = true)
   * keeps the same reference, so React sees no change. Instead we build a new
   * array, and a new object for the habit that changed:
   *
   *   setState(prev => prev.map(item => condition ? { ...item, changed } : item))
   *
   * Passing a function to the setter (prev => ...) guarantees we work with the
   * latest state, even if several updates are queued before the next render.
   */
  const toggleHabit = (id: number) => {
    setHabits((prev) =>
      prev.map((habit) => (habit.id === id ? { ...habit, completed: !habit.completed } : habit)),
    );
  };

  const addHabit = (e: SubmitEvent<HTMLFormElement>) => {
    // Stop the browser from reloading the page on form submit.
    e.preventDefault();

    const name = newHabit.trim();
    if (name === "") return;

    setHabits((prev) => {
      const nextId = Math.max(0, ...prev.map((habit) => habit.id)) + 1;
      return [...prev, { id: nextId, name, completed: false }];
    });
    setNewHabit("");
  };

  /**
   * OPTIONAL: useMemo.
   *
   * Everything in a component body runs on every render. useMemo remembers the
   * result of a calculation and recomputes it only when a dependency in the
   * array changes. Here: typing in the input re-renders App, but the progress
   * numbers are recomputed only when `habits` changes.
   *
   * For a calculation this cheap the saving is negligible; the point is to
   * learn the pattern. Without useMemo the code would simply be:
   *   const completedCount = habits.filter((h) => h.completed).length;
   */
  const completedCount = useMemo(() => habits.filter((habit) => habit.completed).length, [habits]);

  return (
    <main className="container">
      <div className="card">
        <h1>Daily Habit Tracker</h1>

        {/* Props: data passed from a parent component to a child. */}
        <ProgressBar completed={completedCount} total={habits.length} />

        <form className="addForm" onSubmit={addHabit}>
          <input
            value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            placeholder="Add a new habit…"
            aria-label="New habit"
            maxLength={60}
          />
          <button type="submit">Add</button>
        </form>

        {/* A function can be a prop too: the child calls it to tell the parent
            that something happened. The state itself stays here, in App. */}
        <HabitList habits={habits} onToggle={toggleHabit} />
      </div>
    </main>
  );
}
