import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './TextField.module.css';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  helper?: ReactNode;
  /** Error message; when set the field is marked invalid and the message replaces the helper. */
  error?: ReactNode;
  /** Status line shown in `--ok` (for example "Available"). Ignored when `error` is set. */
  ok?: ReactNode;
  suffix?: ReactNode;
  id?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, helper, error, ok, suffix, id: idProp, className, ...rest },
  ref,
) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const messageId = `${id}-message`;
  const message = error ?? ok ?? helper;
  const tone = error ? 'danger' : ok ? 'ok' : 'muted';

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control} data-invalid={error ? true : undefined}>
        <input
          ref={ref}
          id={id}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          {...rest}
        />
        {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
      </div>
      {message ? (
        <div id={messageId} className={styles.message} data-tone={tone} aria-live="polite">
          {message}
        </div>
      ) : null}
    </div>
  );
});
