import styles from './hud.module.css';

export type ResourceTone = 'hp' | 'chakra' | 'stamina' | 'shield';

export interface ResourceBarProps {
  label: string;
  value: number;
  max: number;
  tone: ResourceTone;
  /** Right-to-left fill for the opponent's side. */
  mirror?: boolean;
  testId?: string;
}

/** A labelled bar with its number, never conveying state by colour alone. */
export function ResourceBar({ label, value, max, tone, mirror = false, testId }: ResourceBarProps) {
  const shown = Math.max(0, Math.round(value));
  const fraction = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className={styles.bar} data-tone={tone} data-mirror={mirror || undefined}>
      <div className={styles.barHead}>
        <span className={styles.barLabel}>{label}</span>
        <span className={styles.barValue} data-testid={testId}>
          {shown}
          <span className={styles.barMax}>/{max}</span>
        </span>
      </div>
      <div
        className={styles.barTrack}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={shown}
      >
        <div className={styles.barFill} style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}
