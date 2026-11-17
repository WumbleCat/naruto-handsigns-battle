import {
  DT_MS,
  JUTSU_BY_SLOT,
  JUTSUS,
  MOCK_KEY_FOR_SIGN,
  SIGN_LABELS,
  type DuelSign,
  type InputMode,
  type JutsuId,
  type PlayerNetState,
} from '@jutsu-duel/duel-shared';
import { SignFigure } from '../../features/jutsu/SignFigure';
import styles from './hud.module.css';

export interface JutsuPanelProps {
  player: PlayerNetState;
  tick: number;
  inputMode: InputMode;
  /** The pose the webcam currently sees, if any. */
  heldSign?: DuelSign | null;
  heldFraction?: number;
  onSelect: (jutsuId: JutsuId) => void;
  onCancel: () => void;
}

function readyTick(player: PlayerNetState, jutsuId: JutsuId): number {
  return jutsuId === 'fireball'
    ? player.fireballReadyTick
    : jutsuId === 'lightning_spear'
      ? player.lightningReadyTick
      : player.shieldReadyTick;
}

function seconds(ticks: number): string {
  return `${Math.max(0, (ticks * DT_MS) / 1000).toFixed(1)} s`;
}

/** The three jutsu slots, the selected sequence with progress, and the cast wind-up. */
export function JutsuPanel({
  player,
  tick,
  inputMode,
  heldSign = null,
  heldFraction = 0,
  onSelect,
  onCancel,
}: JutsuPanelProps) {
  const selected = JUTSUS[player.selectedJutsuId as JutsuId] ?? JUTSUS.fireball;
  const casting = player.castJutsuId !== '' && tick < player.castEndsTick;
  const locked = player.signIndex > 0;

  return (
    <div className={styles.jutsu} data-testid="jutsu-panel">
      <div className={styles.slots} role="group" aria-label="Jutsu slots">
        {JUTSU_BY_SLOT.map((jutsuId, index) => {
          const def = JUTSUS[jutsuId];
          const remaining = readyTick(player, jutsuId) - tick;
          const isSelected = player.selectedJutsuId === jutsuId;
          return (
            <button
              key={jutsuId}
              type="button"
              className={styles.slot}
              data-selected={isSelected || undefined}
              data-cooling={remaining > 0 || undefined}
              aria-pressed={isSelected}
              disabled={locked && !isSelected}
              onClick={() => onSelect(jutsuId)}
            >
              <kbd className={styles.key}>{index + 1}</kbd>
              <span className={styles.slotName}>{def.name}</span>
              <span className={styles.slotMeta}>
                {remaining > 0 ? `${seconds(remaining)} cooldown` : `${def.chakra} chakra`}
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.sequence} aria-live="polite" data-testid="sign-sequence">
        <span className={styles.sequenceLabel}>
          {casting ? `Casting ${selected.name}` : `${selected.name} signs`}
        </span>
        <ol className={styles.signs}>
          {selected.signs.map((sign, index) => {
            const state =
              index < player.signIndex ? 'done' : index === player.signIndex ? 'next' : 'todo';
            const holding = heldSign === sign && state === 'next';
            return (
              <li
                key={`${sign}-${index}`}
                className={styles.sign}
                data-state={state}
                data-holding={holding || undefined}
              >
                {inputMode === 'webcam' ? (
                  <SignFigure sign={sign} size={44} bare decorative />
                ) : null}
                <span className={styles.signName}>{SIGN_LABELS[sign]}</span>
                {inputMode === 'mock' ? (
                  <kbd className={styles.key}>{MOCK_KEY_FOR_SIGN[sign]}</kbd>
                ) : null}
                <span className={styles.signMark} aria-hidden="true">
                  {state === 'done' ? '✓' : holding ? `${Math.round(heldFraction * 100)}%` : '○'}
                </span>
                <span className="visually-hidden">
                  {state === 'done' ? 'done' : state === 'next' ? 'next' : 'later'}
                </span>
              </li>
            );
          })}
        </ol>
        {locked ? (
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancel signs (Backspace)
          </button>
        ) : null}
      </div>
    </div>
  );
}
