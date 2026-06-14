import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Drop-in replacement for useState whose latest value is mirrored into a
 * module-level cache. The cache lives outside React, so the value survives a
 * component unmount for the lifetime of the session (until full app restart).
 * On remount the hook hydrates from the cache instead of `initial`.
 *
 * Keys must be unique per logical piece of page state, e.g. "events.filters".
 * Holds rich values (Date, Map) directly — no serialization.
 *
 * NOTE: `key` is read once on mount for hydration; changing `key` on an already
 * mounted component is not supported (it will not re-hydrate from the new key).
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

  // Mirror the latest committed value into the cache (kept out of the state
  // updater so the updater stays pure for StrictMode / concurrent rendering).
  useEffect(() => {
    cache.set(key, state);
  }, [key, state]);

  return [state, setState];
}
