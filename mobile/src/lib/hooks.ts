import { useEffect, useState } from "react";

/** The value, once it has stopped changing for `ms`. Compared by JSON so a fresh object with the same answers doesn't reset the timer. */
export function useDebounced<T>(value: T, ms: number): T {
  const key = JSON.stringify(value);
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(JSON.parse(key) as T), ms);
    return () => clearTimeout(id);
  }, [key, ms]);
  return settled;
}
