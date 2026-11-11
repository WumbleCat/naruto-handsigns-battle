import type { ReactNode } from 'react';
import styles from './StateBlock.module.css';

interface StateBlockProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

/** An empty screen is an invitation to act: title, one line, one action. */
export function EmptyState({ title, children, action }: StateBlockProps) {
  return (
    <div className={styles.block} data-tone="empty">
      <p className={styles.title}>{title}</p>
      {children ? <div className={styles.body}>{children}</div> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}

/** Errors say what happened and how to fix it, without apologising or being vague. */
export function ErrorState({ title, children, action }: StateBlockProps) {
  return (
    <div className={styles.block} data-tone="error" role="alert">
      <p className={styles.title}>{title}</p>
      {children ? <div className={styles.body}>{children}</div> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
