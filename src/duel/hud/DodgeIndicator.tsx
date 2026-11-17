import { DT_MS, DUEL_CONFIG, type PlayerNetState } from '@jutsu-duel/duel-shared';
import styles from './hud.module.css';

export interface DodgeIndicatorProps {
  player: PlayerNetState;
  tick: number;
}

/** Space key state: ready, cooling down, or short of stamina. */
export function DodgeIndicator({ player, tick }: DodgeIndicatorProps) {
  const cooldownTicks = player.dodgeReadyTick - tick;
  const dodging = tick < player.dodgeEndsTick;
  const lowStamina = player.stamina < DUEL_CONFIG.dodge.staminaCost;
  const status = dodging
    ? 'Dodging'
    : cooldownTicks > 0
      ? `Cooldown ${((cooldownTicks * DT_MS) / 1000).toFixed(1)} s`
      : lowStamina
        ? `Needs ${DUEL_CONFIG.dodge.staminaCost} stamina`
        : 'Ready';
  const state = dodging ? 'active' : cooldownTicks > 0 || lowStamina ? 'blocked' : 'ready';
  return (
    <div className={styles.dodge} data-state={state} data-testid="dodge-indicator">
      <kbd className={styles.key}>Space</kbd>
      <span className={styles.dodgeLabel}>Dodge</span>
      <span className={styles.dodgeStatus}>{status}</span>
    </div>
  );
}
