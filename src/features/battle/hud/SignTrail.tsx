import { Seal } from '../../../components/Seal/Seal';
import type { ThemedElement } from '../../../content/types';
import type { SignId } from '../../../engine/types';
import styles from './SignTrail.module.css';

export interface SignTrailProps {
  buffer: readonly SignId[];
  /** 'ltr' fills left to right (the player); 'rtl' fills right to left (the opponent). */
  direction: 'ltr' | 'rtl';
  /** Element read from the opener, colouring the filled seals. */
  element: ThemedElement | null;
  slots?: number;
  /** Name of the jutsu the buffer uniquely matches, shown under the player's own trail. */
  candidate?: string | null;
  /** True during the last moments before the buffer times out. */
  fading?: boolean;
  label: string;
}

export function SignTrail({
  buffer,
  direction,
  element,
  slots = 6,
  candidate,
  fading = false,
  label,
}: SignTrailProps) {
  const tiles = Array.from({ length: slots }, (_, index) => buffer[index] ?? null);
  return (
    <div className={styles.trail} data-direction={direction} data-fading={fading || undefined}>
      <ol className={styles.slots} aria-label={label}>
        {tiles.map((sign, index) => (
          <li key={sign ? `${index}-${sign}` : `empty-${index}`} className={styles.slot}>
            {sign ? (
              <Seal sign={sign} tint={element ?? undefined} size={32} variant="stamped" pulse />
            ) : (
              <Seal size={32} variant="empty" decorative />
            )}
          </li>
        ))}
      </ol>
      {candidate ? <span className={`t-display-sm ${styles.candidate}`}>{candidate}</span> : null}
    </div>
  );
}
