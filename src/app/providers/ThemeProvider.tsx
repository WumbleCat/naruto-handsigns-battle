import { useEffect, useState, type ReactNode } from 'react';
import { useSettings } from '../../lib/settings/store';
import { LIGHT_QUERY, ResolvedThemeContext, resolveTheme, type ResolvedTheme } from './theme';

/**
 * Writes `data-theme` on <html> from the theme setting and follows the OS while the setting
 * is "system". index.html applies the cached choice before React loads, so this only ever
 * confirms or updates it.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme } = useSettings();
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(theme));

  useEffect(() => {
    const apply = () => {
      const next = resolveTheme(theme);
      document.documentElement.dataset.theme = next;
      setResolved(next);
    };
    apply();
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(LIGHT_QUERY);
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [theme]);

  return <ResolvedThemeContext.Provider value={resolved}>{children}</ResolvedThemeContext.Provider>;
}
