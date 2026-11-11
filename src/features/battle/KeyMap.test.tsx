// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BALANCE, ENGINE_BALANCE } from '../../content/balance.config';
import { CONTENT } from '../../content/content.config';
import { ROSTER, ROSTER_BY_ID } from '../../content/roster';
import { KeyboardSignDetector } from '../../detection/keyboard';
import type { EngineEvent } from '../../engine/events';
import type { SignId } from '../../engine/types';
import { DEFAULT_KEY_BINDINGS } from '../../lib/settings/schema';
import type { OpponentContext, OpponentSource, OpponentStatus } from '../../opponent/types';
import { BattleController } from './BattleController';
import { KeyMap } from './KeyMap';

const HOLD_MS = 250;

/** An opponent that does nothing, so only the player's buttons move the match. */
class IdleOpponent implements OpponentSource {
  readonly kind = 'bot' as const;
  readonly displayName = 'Dummy';
  readonly mediaStream = null;
  status: OpponentStatus = 'ready';
  start(_context: OpponentContext): void {}
  stop(): void {}
  onSign(): () => void {
    return () => undefined;
  }
  onStatus(): () => void {
    return () => undefined;
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('KeyMap as a sign pad', () => {
  it('renders plain tiles without handlers and buttons with them', () => {
    const { rerender } = render(<KeyMap bindings={DEFAULT_KEY_BINDINGS} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(
      <KeyMap
        bindings={DEFAULT_KEY_BINDINGS}
        compact
        holdMs={HOLD_MS}
        onHold={() => undefined}
        onRelease={() => undefined}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(12);
    expect(screen.getByRole('button', { name: CONTENT.signs.tiger.name })).toBeInTheDocument();
  });

  it('holds on pointer down and releases no sooner than the hold time', () => {
    const onHold = vi.fn();
    const onRelease = vi.fn();
    render(
      <KeyMap
        bindings={DEFAULT_KEY_BINDINGS}
        holdMs={HOLD_MS}
        onHold={onHold}
        onRelease={onRelease}
      />,
    );
    const tiger = screen.getByRole('button', { name: /Tiger/ });

    // A quick click still holds for the full time.
    fireEvent.pointerDown(tiger);
    fireEvent.pointerUp(tiger);
    fireEvent.click(tiger);
    expect(onHold).toHaveBeenCalledWith('tiger');
    expect(onRelease).not.toHaveBeenCalled();
    vi.advanceTimersByTime(HOLD_MS + 100);
    expect(onRelease).toHaveBeenCalledWith('tiger');
    expect(onHold).toHaveBeenCalledTimes(1);

    // A long press releases when the pointer lifts.
    fireEvent.pointerDown(tiger);
    vi.advanceTimersByTime(1000);
    expect(onRelease).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(tiger);
    expect(onRelease).toHaveBeenCalledTimes(2);
  });

  it('taps from the keyboard and releases held signs on unmount', () => {
    const onHold = vi.fn();
    const onRelease = vi.fn();
    const { unmount } = render(
      <KeyMap
        bindings={DEFAULT_KEY_BINDINGS}
        holdMs={HOLD_MS}
        onHold={onHold}
        onRelease={onRelease}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Horse/ }));
    expect(onHold).toHaveBeenCalledWith('horse');
    vi.advanceTimersByTime(HOLD_MS + 100);
    expect(onRelease).toHaveBeenCalledWith('horse');

    fireEvent.pointerDown(screen.getByRole('button', { name: /Rat/ }));
    unmount();
    expect(onRelease).toHaveBeenLastCalledWith('rat');
  });

  it('casts a jutsu through the real detector, stabiliser and engine by clicking its signs', async () => {
    let clock = 10_000;
    const detector = new KeyboardSignDetector({
      bindings: DEFAULT_KEY_BINDINGS,
      now: () => clock,
      schedule: null,
    });
    const controller = new BattleController({
      balance: { ...ENGINE_BALANCE, signHoldMs: BALANCE.signHoldMs },
      roster: ROSTER,
      detector,
      opponent: new IdleOpponent(),
      confidenceThreshold: 0.7,
      now: () => clock,
      schedule: null,
    });
    const events: EngineEvent[] = [];
    controller.subscribe((event) => events.push(event));
    await controller.start();

    render(
      <KeyMap
        bindings={DEFAULT_KEY_BINDINGS}
        compact
        holdMs={BALANCE.signHoldMs}
        onHold={(sign: SignId) => detector.hold(sign)}
        onRelease={(sign: SignId) => detector.release(sign)}
      />,
    );

    /** Advance wall time in frames, letting the detector and engine tick as the page would. */
    const run = (ms: number) => {
      for (let elapsed = 0; elapsed < ms; elapsed += 16) {
        clock += 16;
        vi.advanceTimersByTime(16);
        detector.tick();
        controller.step();
      }
    };

    for (const sign of ROSTER_BY_ID.fire_short.sequence) {
      const button = screen.getByRole('button', { name: CONTENT.signs[sign].name });
      fireEvent.pointerDown(button);
      fireEvent.pointerUp(button);
      run(BALANCE.signHoldMs + 200);
    }

    const registered = events.filter((e) => e.type === 'signRegistered');
    expect(registered.map((e) => (e.type === 'signRegistered' ? e.sign : null))).toEqual(
      ROSTER_BY_ID.fire_short.sequence,
    );
    expect(events.some((e) => e.type === 'jutsuCast' && e.jutsuId === 'fire_short')).toBe(true);
    expect(controller.getState().inFlight.map((p) => p.jutsuId)).toEqual(['fire_short']);

    run(ENGINE_BALANCE.flightMs + 50);
    expect(controller.getState().players.p2.hp).toBe(ENGINE_BALANCE.maxHp - 12);
    controller.stop();
  });
});
