import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { BattleState, EngineEvent, EngineEventType } from '../../engine/events';
import type { BattleController, ControllerPhase } from './BattleController';

const noop = () => undefined;

/** The engine snapshot, refreshed on every engine event and phase change. */
export function useEngineSnapshot(controller: BattleController | null): BattleState | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!controller) return noop;
      const offEvent = controller.subscribe(onChange);
      const offPhase = controller.onPhase(onChange);
      return () => {
        offEvent();
        offPhase();
      };
    },
    [controller],
  );
  return useSyncExternalStore(
    subscribe,
    () => controller?.getState() ?? null,
    () => null,
  );
}

export function useControllerPhase(controller: BattleController | null): ControllerPhase {
  const subscribe = useCallback(
    (onChange: () => void) => (controller ? controller.onPhase(onChange) : noop),
    [controller],
  );
  return useSyncExternalStore(
    subscribe,
    () => controller?.getPhase() ?? 'idle',
    () => 'idle' as const,
  );
}

export interface FrameClock {
  /** Wall time (performance.now) at the last animation frame. */
  now: number;
  /** Milliseconds since the hook mounted, measured at the last animation frame. */
  elapsed: number;
}

/**
 * Re-renders the caller once per animation frame while `active` and hands it a wall clock,
 * so time-driven HUD parts never call the clock during render.
 */
export function useFrameTick(active: boolean): FrameClock {
  const [clock, setClock] = useState<FrameClock>({ now: 0, elapsed: 0 });
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (!active) return;
    let handle = 0;
    const loop = () => {
      const now = performance.now();
      startRef.current ??= now;
      setClock({ now, elapsed: now - startRef.current });
      handle = requestAnimationFrame(loop);
    };
    handle = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(handle);
  }, [active]);
  return clock;
}

/** Runs `handler` for every engine event of `type`. The handler may change freely. */
export function useEngineEvent<T extends EngineEventType>(
  controller: BattleController | null,
  type: T,
  handler: (event: Extract<EngineEvent, { type: T }>) => void,
): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    if (!controller) return;
    return controller.subscribe((event) => {
      if (event.type === type) handlerRef.current(event as Extract<EngineEvent, { type: T }>);
    });
  }, [controller, type]);
}
