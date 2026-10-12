/**
 * useLocalStorage(key, initialValue): like useState, but the value survives
 * page reloads because it is also saved in localStorage.
 *
 *   const [favorites, setFavorites] = useLocalStorage<Book[]>("favorites", []);
 *
 * The return type is exactly useState's, so components cannot tell the
 * difference: setFavorites(newList) and setFavorites(prev => …) both work.
 * Any JSON-serialisable type can be stored.
 */
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export function useLocalStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  // Lazy initial state: the function runs only on the first render, so
  // localStorage is not read and parsed again on every render.
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initialValue : (JSON.parse(stored) as T);
    } catch {
      return initialValue; // unreadable or invalid JSON: start fresh
    }
  });

  // Synchronising with an external system is what effects are for: whenever
  // the value changes, write it to localStorage.
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be full or disabled (private browsing); the app still works.
    }
  }, [key, value]);

  return [value, setValue];
}
