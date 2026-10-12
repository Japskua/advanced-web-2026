/**
 * useDebouncedValue(value, delay): the value, but only after it has stopped
 * changing for `delay` milliseconds.
 *
 * Typing "harry potter" changes the query 12 times in a second. Searching on
 * every keystroke would send 12 requests; with a 400 ms debounce we send one,
 * when the user pauses.
 *
 * How it works: every change starts a timer. If the value changes again before
 * the timer fires, the effect's cleanup cancels the old timer and a new one
 * starts. Only a timer that survives `delay` ms updates the debounced value.
 *
 * The hook is generic (<T>), so it works for strings, numbers, objects…
 */
import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timerId = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timerId);
  }, [value, delayMs]);

  return debounced;
}
