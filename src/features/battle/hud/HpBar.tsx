import styles from './HpBar.module.css';

export interface HpBarProps {
  side: 'left' | 'right';
  hp: number;
  maxHp: number;
  name: string;
  /** Below this fraction the fill turns to the danger colour. */
  lowFraction?: number;
}

/** Drains toward the centre of the stage; a ghost segment shrinks after the fill. */
export function HpBar({ side, hp, maxHp, name, lowFraction = 0.25 }: HpBarProps) {
  const fraction = Math.max(0, Math.min(1, hp / maxHp));
  const low = fraction <= lowFraction && hp > 0;
  const digits = String(maxHp).length;
  return (
    <div className={styles.bar} data-side={side} data-low={low || undefined}>
      <div
        className={styles.track}
        role="meter"
        aria-label={`${name} HP`}
        aria-valuemin={0}
        aria-valuemax={maxHp}
        aria-valuenow={hp}
      >
        <span className={styles.ghost} style={{ width: `${fraction * 100}%` }} />
        <span className={styles.fill} style={{ width: `${fraction * 100}%` }} />
      </div>
      <span className={`t-hud-lg ${styles.value}`} style={{ minWidth: `${digits}ch` }}>
        {hp}
      </span>
      <span className={styles.name}>{name}</span>
    </div>
  );
}
