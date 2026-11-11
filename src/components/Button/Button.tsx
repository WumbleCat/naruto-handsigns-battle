import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from '../Spinner/Spinner';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Replaces the label with a spinner while keeping the button's width. */
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon,
    children,
    disabled,
    className,
    type = 'button',
    ...rest
  },
  ref,
) {
  const classes = [styles.button, className].filter(Boolean).join(' ');
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className={styles.content}>
        {icon ? <span className={styles.icon}>{icon}</span> : null}
        {children}
      </span>
      {loading ? (
        <span className={styles.spinner}>
          <Spinner size={size === 'lg' ? 20 : 16} />
        </span>
      ) : null}
    </button>
  );
});
