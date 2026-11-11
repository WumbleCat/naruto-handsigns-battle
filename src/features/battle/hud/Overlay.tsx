import { CONTENT } from '../../../content/content.config';
import styles from './Overlay.module.css';

export interface CountdownOverlayProps {
  /** Milliseconds until the fight starts; the fight word shows for a moment at zero. */
  remainingMs: number;
  /** How long the fight word stays after zero. */
  fightWordMs: number;
}

/** 3, 2, 1 stamp in one per second, then the fight word (docs/FRONTEND_DESIGN.md 6.5). */
export function CountdownOverlay({ remainingMs, fightWordMs }: CountdownOverlayProps) {
  if (remainingMs <= -fightWordMs) return null;
  const digit = Math.ceil(remainingMs / 1000);
  const showFight = remainingMs <= 0;
  return (
    <div className={styles.overlay} data-dim={!showFight || undefined} role="status">
      <span key={showFight ? 'fight' : digit} className={`t-display-lg ${styles.stamp}`}>
        {showFight ? CONTENT.callouts.fight : digit}
      </span>
    </div>
  );
}

export interface ResultWordProps {
  result: 'win' | 'loss' | 'draw';
}

export function ResultWord({ result }: ResultWordProps) {
  const word =
    result === 'win'
      ? CONTENT.callouts.victory
      : result === 'loss'
        ? CONTENT.callouts.defeat
        : CONTENT.callouts.draw;
  return (
    <div className={styles.overlay} data-dim role="status">
      <span className={`t-display-lg ${styles.stamp}`}>{word}</span>
    </div>
  );
}
