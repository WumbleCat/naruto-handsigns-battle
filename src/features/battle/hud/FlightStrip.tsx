import { Seal } from '../../../components/Seal/Seal';
import { CONTENT } from '../../../content/content.config';
import { isRosterJutsuId } from '../../../content/roster';
import type { Projectile } from '../../../engine/events';
import type { PlayerId } from '../../../engine/types';
import styles from './FlightStrip.module.css';

export interface ClashBurst {
  id: number;
  at: number;
  left: { multiplier: number; element: Projectile['element'] };
  right: { multiplier: number; element: Projectile['element'] };
}

export interface DodgeMark {
  id: number;
  at: number;
  /** The player who substituted. */
  player: PlayerId;
}

export interface FlightStripProps {
  projectiles: readonly Projectile[];
  now: number;
  flightMs: number;
  localPlayer: PlayerId;
  bursts: readonly ClashBurst[];
  dodges: readonly DodgeMark[];
  reducedMotion?: boolean;
}

function jutsuName(id: string): string {
  return isRosterJutsuId(id) ? CONTENT.jutsus[id].name : id;
}

function formatMultiplier(value: number): string {
  return `×${value.toFixed(1).replace(/\.0$/, '')}`;
}

/** The band between the HP bars and the video panels where jutsu fly and clash. */
export function FlightStrip({
  projectiles,
  now,
  flightMs,
  localPlayer,
  bursts,
  dodges,
  reducedMotion = false,
}: FlightStripProps) {
  return (
    <div className={styles.strip} aria-hidden="true">
      {projectiles.map((projectile) => {
        const progress = Math.max(0, Math.min(1, (now - projectile.castAt) / flightMs));
        const fromLeft = projectile.caster === localPlayer;
        const position = fromLeft ? progress : 1 - progress;
        return (
          <div
            key={projectile.id}
            className={styles.projectile}
            data-from={fromLeft ? 'left' : 'right'}
            style={{ left: `calc(${position * 100}% - ${position * 48}px)` }}
          >
            <Seal element={projectile.element} size={48} variant="stamped" decorative />
            <span
              className={`t-display-sm ${styles.name}`}
              style={{ color: `var(--${projectile.element})` }}
            >
              {jutsuName(projectile.jutsuId)}
            </span>
            {reducedMotion ? (
              <span className={styles.progress}>
                <span className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
              </span>
            ) : null}
          </div>
        );
      })}

      {bursts.map((burst) => (
        <div key={burst.id} className={styles.burst}>
          <span className="t-hud-md" style={{ color: `var(--${burst.left.element})` }}>
            {formatMultiplier(burst.left.multiplier)}
          </span>
          <span className={styles.burstCore} />
          <span className="t-hud-md" style={{ color: `var(--${burst.right.element})` }}>
            {formatMultiplier(burst.right.multiplier)}
          </span>
        </div>
      ))}

      {dodges.map((dodge) => (
        <div
          key={dodge.id}
          className={styles.dodge}
          data-side={dodge.player === localPlayer ? 'left' : 'right'}
        >
          <Seal element="substitution" size={48} variant="stamped" pulse decorative />
        </div>
      ))}
    </div>
  );
}
