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
  /** Flip horizontally so the figure matches a mirrored camera preview. */
  mirror?: boolean;
  /** Hide from assistive tech when a parent already names the sign. */
  decorative?: boolean;
  /** Draw without the framed background, for use inside another tile. */
  bare?: boolean;
}

/**
 * Draws recorded hand landmarks in the overlay's style (docs/FRONTEND_DESIGN.md 4.4): joints
 * in the text colour, bones in the secondary text colour. Fits the hands' bounding box.
 */
export function SkeletonFigure({
  hands,
  width,
  height,
  size = 160,
  label,
  mirror = false,
  decorative = false,
  bare = false,
}: SkeletonFigureProps) {
  const aspect = width / height || 1;
  const px = (x: number) => (mirror ? 1 - x : x) * aspect;
  const points = hands.flatMap((hand) => hand.landmarks.map((p) => ({ x: px(p.x), y: p.y })));
  if (points.length === 0) return null;
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const span = Math.max(maxX - minX, maxY - minY, 1e-6);
  const pad = 0.1 * span;
  // Centre the square view on the bounding box so a wide pose is not pushed to one side.
  const originX = (minX + maxX) / 2 - span / 2 - pad;
  const originY = (minY + maxY) / 2 - span / 2 - pad;
  const viewBox = `${originX} ${originY} ${span + 2 * pad} ${span + 2 * pad}`;
  const stroke = span / 60;
  const radius = span / 40;

  return (
    <svg
      className={styles.figure}
      data-bare={bare || undefined}
      viewBox={viewBox}
      width={size}
      height={size}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
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
                x1={px(a.x)}
                y1={a.y}
                x2={px(b.x)}
                y2={b.y}
                className={styles.bone}
                strokeWidth={stroke}
              />
            );
          })}
          {hand.landmarks.map((p, index) => (
            <circle key={index} cx={px(p.x)} cy={p.y} r={radius} className={styles.joint} />
          ))}
        </g>
      ))}
    </svg>
  );
}
