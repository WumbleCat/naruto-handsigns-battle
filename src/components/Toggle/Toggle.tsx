import { useId, type ReactNode } from 'react';
import styles from './Toggle.module.css';

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  helper?: ReactNode;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, helper, disabled = false }: ToggleProps) {
  const id = useId();
  const helperId = `${id}-helper`;
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {helper ? (
          <span id={helperId} className={styles.helper}>
            {helper}
          </span>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={helper ? helperId : undefined}
        className={styles.switch}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.knob} aria-hidden="true" />
      </button>
    </div>
  );
}
