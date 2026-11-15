import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { Seal } from '../../components/Seal/Seal';
import { CONTENT } from '../../content/content.config';
import { SIGN_IDS, type SignId } from '../../engine/types';
import { SignFigure } from '../jutsu/SignFigure';
import { keyLabel } from './keyLabel';
import styles from './KeyMap.module.css';

/** Added to the sign hold time so a plain click registers even with frame jitter. */
const TAP_MARGIN_MS = 80;

export interface KeyMapProps {
  bindings: Record<SignId, string>;
  /** The sign whose key is currently held. */
  held?: SignId | null;
  /** 24 px seals and no names, for the battle stage. */
  compact?: boolean;
  /**
   * When given, the tiles become buttons: pressing one holds its sign (`onHold`) and letting
   * go releases it (`onRelease`), never sooner than `holdMs` plus a margin so a click counts.
   */
  onHold?: (sign: SignId) => void;
  onRelease?: (sign: SignId) => void;
  /** The sign hold time from the balance config; required with `onHold`. */
  holdMs?: number;
}

interface Press {
  pointerDown: boolean;
  timerDone: boolean;
  timer: number;
}

/** The twelve signs with their keys, in zodiac order on a four-by-three block. */
export function KeyMap({
  bindings,
  held = null,
  compact = false,
  onHold,
  onRelease,
  holdMs = 0,
}: KeyMapProps) {
  const interactive = onHold !== undefined && onRelease !== undefined;
  const callbacks = useRef({ onHold, onRelease });
  const presses = useRef(new Map<SignId, Press>());
  /** Signs whose last activation came from a pointer, so the synthetic click is ignored. */
  const pointerUsed = useRef(new Set<SignId>());

  useEffect(() => {
    callbacks.current = { onHold, onRelease };
  }, [onHold, onRelease]);

  // Release anything still held when the map unmounts mid-press.
  useEffect(() => {
    const active = presses.current;
    return () => {
      for (const [sign, press] of active) {
        window.clearTimeout(press.timer);
        callbacks.current.onRelease?.(sign);
      }
      active.clear();
    };
  }, []);

  const finish = (sign: SignId) => {
    presses.current.delete(sign);
    callbacks.current.onRelease?.(sign);
  };

  const press = (sign: SignId) => {
    if (presses.current.has(sign)) return;
    const entry: Press = { pointerDown: true, timerDone: false, timer: 0 };
    presses.current.set(sign, entry);
    callbacks.current.onHold?.(sign);
    entry.timer = window.setTimeout(() => {
      entry.timerDone = true;
      if (!entry.pointerDown) finish(sign);
    }, holdMs + TAP_MARGIN_MS);
  };

  const lift = (sign: SignId) => {
    const entry = presses.current.get(sign);
    if (!entry) return;
    entry.pointerDown = false;
    if (entry.timerDone) finish(sign);
  };

  const onPointerDown = (sign: SignId) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button > 0) return;
    pointerUsed.current.add(sign);
    press(sign);
  };

  const onClick = (sign: SignId) => () => {
    // A pointer press already handled this; a keyboard activation (Enter or Space) taps.
    if (pointerUsed.current.delete(sign)) return;
    press(sign);
    lift(sign);
  };

  return (
    <ol
      className={styles.grid}
      data-compact={compact || undefined}
      data-interactive={interactive || undefined}
      aria-label={interactive ? 'Signs' : 'Key bindings'}
    >
      {SIGN_IDS.map((sign) => {
        const name = CONTENT.signs[sign].name;
        const inner = (
          <>
            <kbd className={styles.cap}>{keyLabel(bindings[sign])}</kbd>
            {compact ? null : <SignFigure sign={sign} size={56} bare decorative />}
            <Seal sign={sign} size={24} decorative />
            {compact ? null : <span className={styles.name}>{name}</span>}
          </>
        );
        return (
          <li key={sign} data-held={held === sign || undefined}>
            {interactive ? (
              <button
                type="button"
                className={styles.key}
                data-held={held === sign || undefined}
                aria-label={compact ? name : undefined}
                onPointerDown={onPointerDown(sign)}
                onPointerUp={() => lift(sign)}
                onPointerLeave={() => lift(sign)}
                onPointerCancel={() => lift(sign)}
                onClick={onClick(sign)}
              >
                {inner}
              </button>
            ) : (
              <span className={styles.key} data-held={held === sign || undefined}>
                {inner}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
