import { useState } from 'react';
import { Outlet, ScrollRestoration } from 'react-router';
import { Banner } from '../../components/Banner/Banner';
import { DesktopOnlyNotice } from '../../components/DesktopOnlyNotice/DesktopOnlyNotice';
import { VIEWPORT_DESIGNED_FOR, useViewportClass } from '../../lib/useViewport';
import styles from './layouts.module.css';

const NARROW_DISMISSED_KEY = 'jutsu-duel.narrow-banner-dismissed';

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(NARROW_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Viewport rules from docs/FRONTEND_DESIGN.md 6.12, applied above every route. */
export function RootLayout() {
  const viewport = useViewportClass();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (viewport === 'blocked') return <DesktopOnlyNotice />;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(NARROW_DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
  };

  return (
    <>
      {viewport === 'narrow' && !dismissed ? (
        <div className={styles.narrowBanner}>
          <Banner tone="warn" onDismiss={dismiss}>
            Best at {VIEWPORT_DESIGNED_FOR} px or wider.
          </Banner>
        </div>
      ) : null}
      <Outlet />
      <ScrollRestoration />
    </>
  );
}
