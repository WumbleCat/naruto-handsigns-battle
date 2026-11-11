// The recognition model: fetched once from public/models, validated, and shared through a
// small external store so pages can show "no model installed" versus "ready".
import { useSyncExternalStore } from 'react';
import { MlpClassifier, parseModelFile, type MlpModelFile } from './classifier';

export const DEFAULT_MODEL_URL = '/models/signs-v1.json';

export type ModelState =
  | { status: 'unknown' }
  | { status: 'loading' }
  | { status: 'available'; classifier: MlpClassifier; file: MlpModelFile }
  | { status: 'missing' }
  | { status: 'error'; message: string };

let current: ModelState = { status: 'unknown' };
const listeners = new Set<() => void>();
let inFlight: Promise<ModelState> | null = null;

function set(next: ModelState): void {
  current = next;
  for (const listener of listeners) listener();
}

async function fetchModel(url: string): Promise<ModelState> {
  let response: Response;
  try {
    response = await fetch(url, { cache: 'no-cache' });
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Network error' };
  }
  if (response.status === 404) return { status: 'missing' };
  if (!response.ok) return { status: 'error', message: `HTTP ${response.status}` };
  // Dev servers and SPA hosts answer unknown paths with index.html, so a non-JSON body means
  // there is no model file rather than a broken one.
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) return { status: 'missing' };
  try {
    const file = parseModelFile(await response.json());
    return { status: 'available', classifier: new MlpClassifier(file), file };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Invalid model' };
  }
}

const get = (): ModelState => current;

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Loads the model once; concurrent callers share the request. Resolves to the final state. */
const load = (url: string = DEFAULT_MODEL_URL): Promise<ModelState> => {
  if (current.status === 'available') return Promise.resolve(current);
  if (inFlight) return inFlight;
  set({ status: 'loading' });
  inFlight = fetchModel(url).then((state) => {
    inFlight = null;
    set(state);
    return state;
  });
  return inFlight;
};

/** Test helper. */
const reset = (): void => {
  inFlight = null;
  set({ status: 'unknown' });
};

export const modelStore = { get, subscribe, load, reset };

export function useModelState(): ModelState {
  return useSyncExternalStore(subscribe, get, get);
}

export function isModelAvailable(): boolean {
  return current.status === 'available';
}
