import type { Habit } from "../types";
import HabitItem from "./HabitItem";

// Props are declared as a TypeScript type, so passing the wrong data to the
// component is a compile error.
interface HabitListProps {
  habits: Habit[];
  onToggle: (id: number) => void;
}

// `Readonly<...>` documents that a component must never modify its props.
export default function HabitList({ habits, onToggle }: Readonly<HabitListProps>) {
  if (habits.length === 0) {
    return <p className="empty">No habits yet. Add your first one above.</p>;
  }

  return (
    <ul className="list">
      {/*
        Rendering a list: map each item to an element. React needs a stable,
        unique `key` for each item to know which element is which between
        renders. Use an id, not the array index.
      */}
      {habits.map((habit) => (
        <HabitItem key={habit.id} habit={habit} onToggle={onToggle} />
      ))}
    </ul>
  );
}
