import { describe, expect, it } from 'vitest';
import { ENGINE_BALANCE } from '../../content/balance.config';
import { ROSTER, ROSTER_BY_ID } from '../../content/roster';
import type {
  DetectorError,
  DetectorStatus,
  SignDetector,
  SignFrame,
  Unsubscribe,
} from '../../detection/types';
import type { EngineEvent } from '../../engine/events';
import type { SignId } from '../../engine/types';
import type { OpponentContext, OpponentSource, OpponentStatus } from '../../opponent/types';
import { BattleController } from './BattleController';

class FakeDetector implements SignDetector {
  readonly kind = 'keyboard' as const;
  status: DetectorStatus = 'idle';
  readonly error: DetectorError | null = null;
  started = 0;
  stopped = 0;
  private listeners = new Set<(frame: SignFrame) => void>();

  start(): Promise<void> {
    this.started += 1;
    this.status = 'ready';
    return Promise.resolve();
  }

  stop(): void {
    this.stopped += 1;
    this.status = 'idle';
  }

  onFrame(listener: (frame: SignFrame) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(): Unsubscribe {
    return () => undefined;
  }

  emit(frame: SignFrame): void {
    for (const listener of this.listeners) listener(frame);
  }
}

/** Opponent that emits a scripted list of (engineTime, sign) pairs when ticked. */
class ScriptedOpponent implements OpponentSource {
  readonly kind = 'bot' as const;
  readonly displayName = 'Script';
  readonly mediaStream = null;
  status: OpponentStatus = 'ready';
  started = 0;
  stopped = 0;
  private listeners = new Set<(sign: SignId, t: number) => void>();
  private index = 0;
  private readonly script: Array<[number, SignId]>;

  constructor(script: Array<[number, SignId]>) {
    this.script = script;
  }

  start(_context: OpponentContext): void {
    this.started += 1;
  }

  stop(): void {
    this.stopped += 1;
  }

  tick(now: number): void {
    while (this.index < this.script.length) {
      const entry = this.script[this.index];
      if (!entry || entry[0] > now) break;
      this.index += 1;
      for (const listener of this.listeners) listener(entry[1], entry[0]);
    }
  }

  onSign(listener: (sign: SignId, t: number) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(): Unsubscribe {
    return () => undefined;
  }
}

function setup(script: Array<[number, SignId]> = []) {
  let clock = 5_000;
  const detector = new FakeDetector();
  const opponent = new ScriptedOpponent(script);
  const controller = new BattleController({
    balance: { ...ENGINE_BALANCE, signHoldMs: 250 },
    roster: ROSTER,
    detector,
    opponent,
    confidenceThreshold: 0.7,
    now: () => clock,
    schedule: null,
  });
  const events: EngineEvent[] = [];
  controller.subscribe((event) => events.push(event));
  const advance = (ms: number) => {
    clock += ms;
    controller.step();
  };
  /** Holds a sign for `ms` by emitting frames every 50 ms. */
  const hold = (sign: SignId | 'none', ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      detector.emit({ t: clock, sign, confidence: sign === 'none' ? 0 : 0.95 });
      advance(50);
    }
  };
  return { controller, detector, opponent, events, advance, hold, now: () => clock };
}

describe('BattleController', () => {
  it('starts the detector and opponent and registers held signs through the stabiliser', async () => {
    const { controller, detector, opponent, events, hold } = setup();
    await controller.start();
    expect(detector.started).toBe(1);
    expect(opponent.started).toBe(1);
    expect(controller.getPhase()).toBe('active');

    hold('tiger', 200);
    expect(events.filter((e) => e.type === 'signRegistered')).toHaveLength(0);
    hold('tiger', 100);
    expect(events.filter((e) => e.type === 'signRegistered')).toHaveLength(1);
    expect(controller.getState().players.p1.buffer).toEqual(['tiger']);
  });

  it('casts a jutsu after a full held sequence and lands it on the opponent', async () => {
    const { controller, hold, advance } = setup();
    await controller.start();
    for (const sign of ROSTER_BY_ID.fire_short.sequence) {
      hold(sign, 300);
      hold('none', 50);
    }
    expect(controller.getState().inFlight).toHaveLength(1);
    advance(ENGINE_BALANCE.flightMs + 10);
    expect(controller.getState().players.p2.hp).toBe(ENGINE_BALANCE.maxHp - 12);
  });

  it('feeds opponent signs into the other slot', async () => {
    const base = 5_000;
    const { controller, advance } = setup([
      [base + 100, 'snake'],
      [base + 200, 'monkey'],
      [base + 300, 'boar'],
    ]);
    await controller.start();
    advance(400);
    expect(controller.getState().players.p2.buffer).toEqual([]);
    expect(controller.getState().inFlight.map((p) => p.jutsuId)).toEqual(['water_short']);
  });

  it('freezes engine time while paused and resumes without a jump', async () => {
    const { controller, advance, hold } = setup();
    await controller.start();
    hold('tiger', 300);
    const before = controller.getState().now;
    controller.pause();
    expect(controller.getPhase()).toBe('paused');
    advance(10_000);
    expect(controller.engineNow()).toBe(before);
    controller.resume();
    advance(100);
    expect(controller.getState().now).toBe(before + 100);
    // The buffer did not time out during the pause.
    expect(controller.getState().players.p1.buffer).toEqual(['tiger']);
  });

  it('ignores detector frames while paused', async () => {
    const { controller, hold } = setup();
    await controller.start();
    controller.pause();
    hold('tiger', 500);
    expect(controller.getState().players.p1.buffer).toEqual([]);
  });

  it('forfeits on request and reports the ended phase', async () => {
    const { controller, events } = setup();
    await controller.start();
    controller.forfeit();
    expect(controller.getPhase()).toBe('ended');
    expect(events.at(-1)).toMatchObject({ type: 'matchEnded', winner: 'p2', reason: 'forfeit' });
  });

  it('exposes the current hold for the readout', async () => {
    const { controller, hold } = setup();
    await controller.start();
    hold('tiger', 100);
    const hold1 = controller.getHold();
    expect(hold1.sign).toBe('tiger');
    expect(hold1.fraction).toBeCloseTo(0.4, 1);
    expect(hold1.confidence).toBe(0.95);
  });

  it('stays startable when stopped before it ever started (StrictMode remount)', async () => {
    const { controller, detector, opponent } = setup();
    controller.stop();
    expect(controller.getPhase()).toBe('idle');
    expect(detector.stopped).toBe(0);
    await controller.start();
    expect(controller.getPhase()).toBe('active');
    expect(opponent.started).toBe(1);
  });

  it('stops everything on stop()', async () => {
    const { controller, detector, opponent } = setup();
    await controller.start();
    controller.stop();
    expect(detector.stopped).toBe(1);
    expect(opponent.stopped).toBe(1);
    expect(controller.getPhase()).toBe('ended');
  });
});
