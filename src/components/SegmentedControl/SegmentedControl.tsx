import { useId, type KeyboardEvent } from 'react';
import styles from './SegmentedControl.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Hide the label visually (it stays available to assistive tech). */
  hideLabel?: boolean;
  disabled?: boolean;
}

/** Two or three mutually exclusive options. Radio-group semantics with arrow-key movement. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  hideLabel = false,
  disabled = false,
}: SegmentedControlProps<T>) {
  const labelId = useId();

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const enabled = options.filter((o) => !o.disabled);
    const index = enabled.findIndex((o) => o.value === value);
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = enabled[(index + step + enabled.length) % enabled.length];
    if (next) onChange(next.value);
  };

  return (
    <div className={styles.wrapper}>
      <span id={labelId} className={hideLabel ? 'visually-hidden' : styles.label}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={styles.group}
        onKeyDown={move}
        data-disabled={disabled || undefined}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              className={styles.option}
              data-selected={selected || undefined}
              disabled={disabled || option.disabled}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
