// Keyboard controls for the duel: WASD held state, Space dodge (edge), 1/2/3 slot selection,
// Q/E/R/T/Y/U/I mock signs, Backspace cancel, Escape help. Nothing fires while a text field has
// focus, and held keys clear when the window loses focus.
import { useEffect, useRef, useState } from 'react';
import {
  JUTSU_BY_SLOT,
  MOCK_SIGN_KEYS,
  type DuelSign,
  type JutsuId,
} from '@jutsu-duel/duel-shared';

export interface DuelKeyHandlers {
  onDodge: () => void;
  onSelect: (jutsuId: JutsuId) => void;
  onMockSign: (sign: DuelSign) => void;
  onCancelSigns: () => void;
  onToggleHelp: () => void;
}

export interface DuelKeysHandle {
  /** Current normalised movement intent, read by the input loop; never triggers a render. */
  direction: () => { moveX: number; moveY: number };
  held: () => ReadonlySet<string>;
}

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  KeyS: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

const SLOT_KEYS: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2 };

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}

export function useDuelKeys(
  enabled: boolean,
  mockSigns: boolean,
  handlers: DuelKeyHandlers,
): DuelKeysHandle {
  const held = useRef(new Set<string>());
  const latest = useRef(handlers);

  useEffect(() => {
    latest.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const keys = held.current;
    if (!enabled) {
      keys.clear();
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditable(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      const code = event.code;
      if (code in MOVE_KEYS) {
        keys.add(code);
        event.preventDefault();
        return;
      }
      if (event.repeat) return;
      if (code === 'Space') {
        event.preventDefault();
        latest.current.onDodge();
      } else if (code in SLOT_KEYS) {
        const jutsuId = JUTSU_BY_SLOT[SLOT_KEYS[code] ?? 0];
        if (jutsuId) latest.current.onSelect(jutsuId);
      } else if (mockSigns && code in MOCK_SIGN_KEYS) {
        const sign = MOCK_SIGN_KEYS[code];
        if (sign) latest.current.onMockSign(sign);
      } else if (code === 'Backspace') {
        event.preventDefault();
        latest.current.onCancelSigns();
      } else if (code === 'Escape') {
        latest.current.onToggleHelp();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.code);
    };
    const onBlur = () => keys.clear();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      keys.clear();
    };
  }, [enabled, mockSigns]);

  const [handle] = useState<DuelKeysHandle>(() => ({
    direction: () => {
      let x = 0;
      let y = 0;
      for (const code of held.current) {
        const delta = MOVE_KEYS[code];
        if (delta) {
          x += delta[0];
          y += delta[1];
        }
      }
      return { moveX: Math.max(-1, Math.min(1, x)), moveY: Math.max(-1, Math.min(1, y)) };
    },
    held: () => held.current,
  }));
  return handle;
}
