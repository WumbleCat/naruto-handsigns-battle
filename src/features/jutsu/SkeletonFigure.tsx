import { HAND_CONNECTIONS } from '../../detection/handConnections';
import type { HandLandmarks } from '../../detection/types';
import styles from './SkeletonFigure.module.css';

export interface SkeletonFigureProps {
  hands: readonly HandLandmarks[];
  /** Source frame size, for aspect-correct scaling. */
  width: number;
  height: number;
  /** Rendered box size in px. */
  size?: number;
  label: string;
}

/**
 * Draws recorded hand landmarks in the overlay's style (docs/FRONTEND_DESIGN.md 4.4): joints
 * in the text colour, bones in the secondary text colour. Fits the hands' bounding box.
 */
export function SkeletonFigure({ hands, width, height, size = 160, label }: SkeletonFigureProps) {
  const aspect = width / height || 1;
  const points = hands.flatMap((hand) => hand.landmarks.map((p) => ({ x: p.x * aspect, y: p.y })));
  if (points.length === 0) return null;
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const span = Math.max(maxX - minX, maxY - minY, 1e-6);
  const pad = 0.1 * span;
  const viewBox = `${minX - pad} ${minY - pad} ${span + 2 * pad} ${span + 2 * pad}`;
  const stroke = span / 60;
  const radius = span / 40;

  return (
    <svg
      className={styles.figure}
      viewBox={viewBox}
      width={size}
      height={size}
      role="img"
      aria-label={label}
    >
      {hands.map((hand, handIndex) => (
        <g key={handIndex} opacity={Math.max(0.5, Math.min(1, hand.score))}>
          {HAND_CONNECTIONS.map(([from, to]) => {
            const a = hand.landmarks[from];
            const b = hand.landmarks[to];
            if (!a || !b) return null;
            return (
              <line
                key={`${from}-${to}`}
                x1={a.x * aspect}
                y1={a.y}
                x2={b.x * aspect}
                y2={b.y}
                className={styles.bone}
                strokeWidth={stroke}
              />
            );
          })}
          {hand.landmarks.map((p, index) => (
            <circle key={index} cx={p.x * aspect} cy={p.y} r={radius} className={styles.joint} />
          ))}
        </g>
      ))}
    </svg>
  );
}
