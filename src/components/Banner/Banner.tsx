import type { ReactNode } from 'react';
import styles from './Banner.module.css';

export type BannerTone = 'warn' | 'danger' | 'info';

export interface BannerProps {
  tone?: BannerTone;
  children: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
}

export function Banner({ tone = 'info', children, action, onDismiss }: BannerProps) {
  return (
    <div className={styles.banner} data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
      <div className={styles.message}>{children}</div>
      {action ? <div className={styles.action}>{action}</div> : null}
      {onDismiss ? (
        <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss">
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </div>
  );
}
