import { Seal } from '../../components/Seal/Seal';
import { CONTENT } from '../../content/content.config';
import { ELEMENTS } from '../../engine/types';
import styles from './ElementCycle.module.css';

const SIZE = 320;
const RADIUS = 118;
const SEAL = 64;
const CENTRE = SIZE / 2;

function vertex(index: number): { x: number; y: number } {
  const angle = (index / ELEMENTS.length) * Math.PI * 2 - Math.PI / 2;
  return { x: CENTRE + Math.cos(angle) * RADIUS, y: CENTRE + Math.sin(angle) * RADIUS };
}

/** Shortens the segment between two vertices so arrows start and end outside the seals. */
function trimmed(a: { x: number; y: number }, b: { x: number; y: number }, inset: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  return {
    x1: a.x + ux * inset,
    y1: a.y + uy * inset,
    x2: b.x - ux * inset,
    y2: b.y - uy * inset,
  };
}

const LABEL = ELEMENTS.map((element, index) => {
  const next = ELEMENTS[(index + 1) % ELEMENTS.length] ?? element;
  return `${CONTENT.elements[element].name} beats ${CONTENT.elements[next].name}`;
}).join(', ');

/** Pentagon of element seals with "beats" arrows around the cycle. */
export function ElementCycle() {
  return (
    <div className={styles.cycle} role="img" aria-label={`Element cycle: ${LABEL}.`}>
      <svg
        className={styles.arrows}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <marker
            id="element-cycle-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
          >
            <path d="M0 1 8 5 0 9" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </marker>
        </defs>
        {ELEMENTS.map((element, index) => {
          const from = vertex(index);
          const to = vertex((index + 1) % ELEMENTS.length);
          const line = trimmed(from, to, SEAL / 2 + 8);
          return (
            <line
              key={element}
              {...line}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              markerEnd="url(#element-cycle-arrow)"
            />
          );
        })}
      </svg>
      {ELEMENTS.map((element, index) => {
        const { x, y } = vertex(index);
        return (
          <span
            key={element}
            className={styles.node}
            style={{ left: x - SEAL / 2, top: y - SEAL / 2 }}
          >
            <Seal element={element} size={64} decorative />
            <span className={styles.name}>{CONTENT.elements[element].name}</span>
          </span>
        );
      })}
    </div>
  );
}
