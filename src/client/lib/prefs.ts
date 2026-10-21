"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/** Small per-browser preferences. Storage can be missing or blocked, so every call tolerates failure. */

const PREF_CHANGE = "lt:pref-change";

export function readPref<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const value: unknown = JSON.parse(raw);
    return isValid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not saved; the choice still applies for this visit.
  }
  // Tell everything showing this preference (even if it could not be saved).
  window.dispatchEvent(new Event(PREF_CHANGE));
}

/**
 * A stored preference as a React value. The server and the first client render use `fallback`;
 * the saved value appears right after hydration. Setting it saves and updates every user of it.
 */
export function useStoredPref<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): [T, (next: T) => void] {
  const raw = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(PREF_CHANGE, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(PREF_CHANGE, onChange);
      };
    },
    () => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );

  const value = useMemo(() => {
    if (raw === null) return fallback;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isValid(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
    // `fallback` and `isValid` are constants at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  const set = useCallback(
    (next: T) => {
      writePref(key, next);
    },
    [key],
  );
  return [value, set];
}
