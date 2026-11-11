import type { BotDifficulty } from '../../../content/types';
import styles from './BotAvatar.module.css';

const STROKES: Record<BotDifficulty, number> = { easy: 1, medium: 2, hard: 3 };

/** Original mask: an oval with two slits and one to three brow strokes by difficulty. */
export function BotAvatar({ difficulty, name }: { difficulty: BotDifficulty; name: string }) {
  const strokes = STROKES[difficulty];
  return (
    <div className={styles.avatar} role="img" aria-label={name}>
      <svg viewBox="0 0 120 150" width="120" height="150" aria-hidden="true" focusable="false">
        <ellipse
          cx="60"
          cy="78"
          rx="44"
          ry="58"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path d="M36 80h14M70 80h14" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        {Array.from({ length: strokes }, (_, index) => (
          <path
            key={index}
            d={`M${44 + index * 10} 40 l${8 - index * 2} 16`}
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <span className={styles.name}>{name}</span>
    </div>
  );
}
