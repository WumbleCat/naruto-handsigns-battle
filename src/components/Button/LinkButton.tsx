import type { ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import styles from './Button.module.css';
import type { ButtonSize, ButtonVariant } from './Button';

export interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

/** A router link that looks like a Button. Use for navigation; use Button for actions. */
export function LinkButton({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      className={[styles.button, className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-size={size}
      {...rest}
    >
      <span className={styles.content}>
        {icon ? <span className={styles.icon}>{icon}</span> : null}
        {children}
      </span>
    </Link>
  );
}
