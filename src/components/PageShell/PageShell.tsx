import type { ReactNode } from 'react';
import { CONTENT } from '../../content/content.config';
import styles from './PageShell.module.css';

export interface TopBarProps {
  /** Rendered where the game title sits; a router Link in the app, plain text elsewhere. */
  brand?: ReactNode;
  /** Primary navigation (links). */
  nav?: ReactNode;
  /** Right-hand slot: user menu, log out, theme. */
  end?: ReactNode;
}

export function TopBar({ brand, nav, end }: TopBarProps) {
  return (
    <header className={styles.topBar}>
      <div className={styles.topBarInner}>
        <div className={`${styles.brand} t-display-sm`}>{brand ?? CONTENT.game.title}</div>
        {nav ? (
          <nav className={styles.nav} aria-label="Main">
            {nav}
          </nav>
        ) : null}
        {end ? <div className={styles.end}>{end}</div> : null}
      </div>
    </header>
  );
}

export interface PageShellProps {
  children: ReactNode;
  /** Wider column for tables and the jutsu book. */
  wide?: boolean;
  /** Centre content vertically (auth, 404). */
  centered?: boolean;
  /** Anything that should sit above the content column at full width (banners). */
  before?: ReactNode;
}

/** The centred page column from docs/FRONTEND_DESIGN.md 2.4. */
export function PageShell({ children, wide = false, centered = false, before }: PageShellProps) {
  return (
    <div className={styles.page} data-centered={centered || undefined}>
      {before}
      <main className={styles.column} data-wide={wide || undefined}>
        {children}
      </main>
    </div>
  );
}
