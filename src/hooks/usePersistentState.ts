import { useState, type Dispatch, type SetStateAction } from "react";

/**
 * Drop-in replacement for useState whose latest value is mirrored into a
 * module-level cache. The cache lives outside React, so the value survives a
 * component unmount for the lifetime of the session (until full app restart).
 * On remount the hook hydrates from the cache instead of `initial`.
 *
 * Keys must be unique per logical piece of page state, e.g. "events.filters".
 * Holds rich values (Date, Map) directly — no serialization.
 */
const cache = new Map<string, unknown>();

export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (cache.has(key)) return cache.get(key) as T;
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });

  const setPersistent: Dispatch<SetStateAction<T>> = (value) => {
    setState((prev) => {
      const next =
        typeof value === "function"
          ? (value as (p: T) => T)(prev)
          : value;
      cache.set(key, next);
      return next;
    });
  };

  return [state, setPersistent];
}
