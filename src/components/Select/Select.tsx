import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  options: readonly SelectOption[];
  helper?: ReactNode;
  /** Shown instead of options when the list is empty. */
  emptyLabel?: string;
  id?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, helper, emptyLabel = 'No options', id: idProp, className, disabled, ...rest },
  ref,
) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const helperId = `${id}-helper`;
  const empty = options.length === 0;
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        <select
          ref={ref}
          id={id}
          className={styles.select}
          disabled={disabled || empty}
          aria-describedby={helper ? helperId : undefined}
          {...rest}
        >
          {empty ? (
            <option value="">{emptyLabel}</option>
          ) : (
            options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          )}
        </select>
        <span className={styles.chevron} aria-hidden="true" />
      </div>
      {helper ? (
        <div id={helperId} className={styles.helper}>
          {helper}
        </div>
      ) : null}
    </div>
  );
});
