import type { CSSProperties } from 'react';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  /** Round skeleton for seals and avatars. */
  round?: boolean;
  className?: string;
}

/** Placeholder block shown while content loads. Decorative; parents announce loading. */
export function Skeleton({
  width = '100%',
  height = '1em',
  round = false,
  className,
}: SkeletonProps) {
  return (
    <span
      className={[styles.skeleton, className].filter(Boolean).join(' ')}
      data-round={round || undefined}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
