import type { Habit } from "../types";

// One habit row. The component only displays data and reports clicks; it does
// not own any state. HabitList passes `onToggle` down from App unchanged.
interface HabitItemProps {
  habit: Habit;
  onToggle: (id: number) => void;
}

export default function HabitItem({ habit, onToggle }: Readonly<HabitItemProps>) {
  return (
    <li className="item">
      {/* Conditional class name: the CSS strikes through completed habits. */}
      <span className={habit.completed ? "done" : ""}>{habit.name}</span>

      {/* An arrow function, so onToggle is called with this habit's id on
          click, and not immediately while rendering. */}
      <button onClick={() => onToggle(habit.id)}>{habit.completed ? "Undo" : "Mark done"}</button>
    </li>
  );
}
