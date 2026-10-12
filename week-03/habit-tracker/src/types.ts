// Types shared by several components live in their own module, so that
// components do not have to import types from each other (or from App).
export interface Habit {
  id: number;
  name: string;
  completed: boolean;
}
