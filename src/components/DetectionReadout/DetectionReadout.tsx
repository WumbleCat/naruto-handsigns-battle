import { CONTENT } from '../../content/content.config';
import type { SignId } from '../../engine/types';
import { Seal } from '../Seal/Seal';
import styles from './DetectionReadout.module.css';

export interface DetectionReadoutProps {
  /** The sign currently being held, or null. */
  sign: SignId | null;
  /** 0..1 classifier confidence for the current sign (1 for the keyboard). */
  confidence: number;
  /** 0..1 of the hold time elapsed; 1 once registered. */
  holdFraction: number;
  /** Shown instead of the sign name while nothing is held. */
  idleText?: string;
  /** Short status line (for example "Tracking poor"). */
  note?: string;
}

/** What the camera sees right now: seal, name, hold ring and confidence meter. */
export function DetectionReadout({
  sign,
  confidence,
  holdFraction,
  idleText = 'No sign',
  note,
}: DetectionReadoutProps) {
  const registered = sign !== null && holdFraction >= 1;
  return (
    <div className={styles.readout} aria-live="polite">
      {sign ? (
        <Seal
          sign={sign}
          size={48}
          variant={registered ? 'stamped' : 'ring'}
          progress={holdFraction}
          decorative
        />
      ) : (
        <Seal size={48} variant="empty" decorative />
      )}
      <div className={styles.text}>
        <span className={styles.name}>{sign ? CONTENT.signs[sign].name : idleText}</span>
        <span className={styles.meter} aria-hidden="true">
          <span
            className={styles.meterFill}
            style={{ width: `${Math.max(0, Math.min(1, confidence)) * 100}%` }}
          />
        </span>
        {note ? <span className={styles.note}>{note}</span> : null}
      </div>
    </div>
  );
}
