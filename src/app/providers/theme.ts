import { createContext, useContext } from 'react';
import type { Theme } from '../../lib/settings/schema';

export type ResolvedTheme = Exclude<Theme, 'system'>;

export const LIGHT_QUERY = '(prefers-color-scheme: light)';

export function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark';
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? systemTheme() : theme;
}

export const ResolvedThemeContext = createContext<ResolvedTheme>('dark');

/** The theme actually on screen ("dark" or "light"), after "system" is resolved. */
export function useResolvedTheme(): ResolvedTheme {
  return useContext(ResolvedThemeContext);
}
