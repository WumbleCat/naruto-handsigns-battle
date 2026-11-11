import { useEffect, useRef, useState } from 'react';

/**
 * True for `durationMs` after any watched value changes (not on first render), so a section can
 * show "Saved" right after an auto-saved change.
 */
export function useSavedFlash(watched: readonly unknown[], durationMs = 2000): boolean {
  const [saved, setSaved] = useState(false);
  const first = useRef(true);
  const key = JSON.stringify(watched);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let timer = 0;
    const show = window.setTimeout(() => {
      setSaved(true);
      timer = window.setTimeout(() => setSaved(false), durationMs);
    }, 0);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(timer);
    };
  }, [key, durationMs]);

  return saved;
}
