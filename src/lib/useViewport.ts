import { useSyncExternalStore } from 'react';

/** Below this width the app is replaced by the desktop-only notice. */
export const VIEWPORT_BLOCK_BELOW = 1024;
/** Below this width a dismissible banner says the layout is best at 1280 px or wider. */
export const VIEWPORT_DESIGNED_FOR = 1280;

export type ViewportClass = 'blocked' | 'narrow' | 'ok';

function classify(width: number): ViewportClass {
  if (width < VIEWPORT_BLOCK_BELOW) return 'blocked';
  if (width < VIEWPORT_DESIGNED_FOR) return 'narrow';
  return 'ok';
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

function getSnapshot(): ViewportClass {
  return classify(window.innerWidth);
}

function getServerSnapshot(): ViewportClass {
  return 'ok';
}

export function useViewportClass(): ViewportClass {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
