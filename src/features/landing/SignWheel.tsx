import { useEffect, useState } from 'react';
import { Glyph } from '../../components/Seal/Glyph';
import { Seal } from '../../components/Seal/Seal';
import { CONTENT } from '../../content/content.config';
import { SIGN_IDS } from '../../engine/types';
import { useReducedMotion } from '../../lib/useReducedMotion';
import styles from './SignWheel.module.css';

const RADIUS = 150;
const STEP_MS = 1600;
const START_INDEX = SIGN_IDS.indexOf('tiger');

/** The twelve signs in a ring; the highlighted one stamps and its glyph fills the centre. */
export function SignWheel() {
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(START_INDEX);

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setIndex((current) => (current + 1) % SIGN_IDS.length);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  const current = SIGN_IDS[index] ?? 'tiger';

  return (
    <div
      className={styles.wheel}
      role="img"
      aria-label={`The twelve hand signs. Showing ${CONTENT.signs[current].name}.`}
    >
      {SIGN_IDS.map((sign, i) => {
        const angle = (i / SIGN_IDS.length) * Math.PI * 2 - Math.PI / 2;
        const x = Math.round(Math.cos(angle) * RADIUS);
        const y = Math.round(Math.sin(angle) * RADIUS);
        const active = i === index;
        return (
          <span
            key={sign}
            className={styles.slot}
            style={{ transform: `translate(${x}px, ${y}px)` }}
          >
            <Seal
              sign={sign}
              size={48}
              variant={active ? 'stamped' : 'outline'}
              pulse={active && !reducedMotion}
              decorative
            />
          </span>
        );
      })}
      <div className={styles.centre}>
        <Glyph id={current} size={96} />
        <span className={`t-display-sm ${styles.centreName}`}>{CONTENT.signs[current].name}</span>
      </div>
    </div>
  );
}
