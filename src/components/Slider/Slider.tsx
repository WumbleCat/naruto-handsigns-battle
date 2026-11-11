import { useId, type ReactNode } from 'react';
import styles from './Slider.module.css';

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Format the readout; defaults to the raw number. */
  format?: (value: number) => string;
  helper?: ReactNode;
  disabled?: boolean;
  /** Optional live meter rendered under the track (0..1), for the detection threshold. */
  meter?: number;
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => String(v),
  helper,
  disabled = false,
  meter,
}: SliderProps) {
  const id = useId();
  const helperId = `${id}-helper`;
  return (
    <div className={styles.field}>
      <div className={styles.head}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <output htmlFor={id} className={styles.readout}>
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className={styles.range}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-describedby={helper ? helperId : undefined}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      {meter !== undefined ? (
        <div className={styles.meter} aria-hidden="true">
          <span
            className={styles.meterFill}
            style={{ width: `${Math.max(0, Math.min(1, meter)) * 100}%` }}
          />
        </div>
      ) : null}
      {helper ? (
        <div id={helperId} className={styles.helper}>
          {helper}
        </div>
      ) : null}
    </div>
  );
}
