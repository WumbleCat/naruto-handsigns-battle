// Settings store: one in-memory Settings object, cached in localStorage so it applies before
// login and before any network round trip. Supabase write-through hooks in here later
// (milestone v0.5.0) via `onPersist`.
import { useSyncExternalStore } from 'react';
import { DEFAULT_SETTINGS, parseSettings, type Settings } from './schema';

export const SETTINGS_STORAGE_KEY = 'jutsu-duel.settings';

type Listener = () => void;
type Persister = (settings: Settings) => void;

function readLocal(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return parseSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeLocal(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode or blocked storage: settings still work for this session.
  }
}

let current: Settings = typeof localStorage === 'undefined' ? DEFAULT_SETTINGS : readLocal();
const listeners = new Set<Listener>();
const persisters = new Set<Persister>();

function emit(): void {
  for (const listener of listeners) listener();
}

const get = (): Settings => current;

const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Merge a partial change, persist it, and notify subscribers. */
const update = (patch: Partial<Settings>): void => {
  current = parseSettings({ ...current, ...patch });
  writeLocal(current);
  emit();
  for (const persist of persisters) persist(current);
};

/** Replace everything (for example with the row loaded from Supabase). */
const replace = (settings: unknown): void => {
  current = parseSettings(settings);
  writeLocal(current);
  emit();
};

/** Register an external persister (Supabase). Returns an unsubscribe function. */
const onPersist = (persist: Persister): (() => void) => {
  persisters.add(persist);
  return () => persisters.delete(persist);
};

/** Test helper: reset to defaults without touching persisters. */
const reset = (): void => {
  current = DEFAULT_SETTINGS;
  writeLocal(current);
  emit();
};

export const settingsStore = { get, subscribe, update, replace, onPersist, reset };

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, get, get);
}
