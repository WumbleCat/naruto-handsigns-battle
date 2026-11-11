// Wires engine, detector, stabiliser, opponent and clock (docs/DESIGN.md 8.7). A plain class
// with no React so the same wiring runs under tests with a fake detector and a scripted
// opponent. Engine time is wall time minus everything spent paused, so pausing freezes the
// match and the bot together.
import type { SignDetector, SignFrame } from '../../detection/types';
import { BattleEngine } from '../../engine/engine';
import type { BattleState, EngineEvent } from '../../engine/events';
import { SignStabilizer } from '../../engine/stabilizer';
import type { EngineBalance, JutsuDef, PlayerId, SignId } from '../../engine/types';
import type { OpponentSource } from '../../opponent/types';

export type ControllerPhase = 'idle' | 'active' | 'paused' | 'ended';

export interface BattleControllerOptions<D extends SignDetector = SignDetector> {
  balance: EngineBalance & { signHoldMs: number };
  roster: readonly JutsuDef[];
  detector: D;
  opponent: OpponentSource;
  confidenceThreshold: number;
  /** Wall clock in ms; defaults to performance.now. */
  now?: () => number;
  /** Frame scheduler; defaults to requestAnimationFrame. Tests pass null and call step(). */
  schedule?: ((callback: () => void) => number) | null;
  cancel?: (handle: number) => void;
}

export interface HoldState {
  sign: SignId | null;
  fraction: number;
  confidence: number;
}

type Unsubscribe = () => void;

export class BattleController<D extends SignDetector = SignDetector> {
  readonly localPlayer: PlayerId = 'p1';
  readonly engine: BattleEngine;
  readonly stabilizer: SignStabilizer;
  readonly opponent: OpponentSource;
  /** Public so the page can hand a webcam detector its landmark frames. */
  readonly detector: D;
  private readonly now: () => number;
  private readonly schedule: ((callback: () => void) => number) | null;
  private readonly cancel: (handle: number) => void;
  private phase: ControllerPhase = 'idle';
  private pausedAt = 0;
  private pausedTotal = 0;
  private frameHandle = 0;
  private lastFrame: SignFrame | null = null;
  private readonly cleanups: Unsubscribe[] = [];
  private readonly phaseListeners = new Set<(phase: ControllerPhase) => void>();

  constructor(options: BattleControllerOptions<D>) {
    this.now = options.now ?? (() => performance.now());
    this.schedule =
      options.schedule === undefined
        ? (callback) => requestAnimationFrame(callback)
        : options.schedule;
    this.cancel = options.cancel ?? ((handle) => cancelAnimationFrame(handle));
    this.detector = options.detector;
    this.opponent = options.opponent;
    this.stabilizer = new SignStabilizer({
      holdMs: options.balance.signHoldMs,
      threshold: options.confidenceThreshold,
    });
    this.engine = new BattleEngine({
      balance: options.balance,
      roster: options.roster,
      startedAt: this.now(),
    });
  }

  getPhase(): ControllerPhase {
    return this.phase;
  }

  onPhase(listener: (phase: ControllerPhase) => void): Unsubscribe {
    this.phaseListeners.add(listener);
    return () => this.phaseListeners.delete(listener);
  }

  getState(): BattleState {
    return this.engine.getState();
  }

  subscribe(listener: (event: EngineEvent) => void): Unsubscribe {
    return this.engine.subscribe(listener);
  }

  /** Engine time: wall time minus time spent paused; frozen while paused. */
  engineNow(): number {
    const wall = this.phase === 'paused' ? this.pausedAt : this.now();
    return wall - this.pausedTotal;
  }

  /** The sign being held right now and how far along the hold is, for the readout. */
  getHold(): HoldState {
    const progress = this.stabilizer.progress(this.engineNow());
    const frame = this.lastFrame;
    const confidence = frame && frame.sign === progress.sign ? frame.confidence : 0;
    return { sign: progress.sign, fraction: progress.fraction, confidence };
  }

  setConfidenceThreshold(threshold: number): void {
    this.stabilizer.setThreshold(threshold);
  }

  async start(): Promise<void> {
    if (this.phase !== 'idle') return;
    this.setPhase('active');

    this.cleanups.push(
      this.detector.onFrame((frame) => {
        if (this.phase !== 'active') return;
        this.lastFrame = frame;
        const sign = this.stabilizer.observe({ ...frame, t: this.engineNow() });
        if (sign) this.engine.registerSign(this.localPlayer, sign, this.engineNow());
      }),
    );
    this.cleanups.push(
      this.opponent.onSign((sign) => {
        if (this.phase !== 'active') return;
        this.engine.registerSign(this.localPlayer === 'p1' ? 'p2' : 'p1', sign, this.engineNow());
      }),
    );
    this.cleanups.push(
      this.engine.subscribe((event) => {
        if (event.type === 'matchEnded') this.setPhase('ended');
      }),
    );

    this.opponent.start({
      localPlayer: this.localPlayer,
      now: () => this.engineNow(),
      getState: () => this.engine.getState(),
      subscribe: (listener) => this.engine.subscribe(listener),
    });
    await this.detector.start();
    this.queueFrame();
  }

  /** One frame of simulation: advance the engine and the opponent to engine time. */
  step(): void {
    if (this.phase !== 'active') return;
    const t = this.engineNow();
    this.engine.tick(t);
    this.opponent.tick?.(t);
  }

  pause(): void {
    if (this.phase !== 'active') return;
    this.pausedAt = this.now();
    this.setPhase('paused');
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    this.pausedTotal += this.now() - this.pausedAt;
    this.stabilizer.reset();
    this.setPhase('active');
    this.queueFrame();
  }

  forfeit(): void {
    if (this.phase === 'paused') this.resume();
    if (this.phase !== 'active') return;
    this.engine.forfeit(this.localPlayer, this.engineNow());
  }

  /**
   * Tears everything down. A controller that never started stays idle and startable, which
   * is what React StrictMode's mount, unmount, mount sequence in development relies on.
   */
  stop(): void {
    if (this.frameHandle) this.cancel(this.frameHandle);
    this.frameHandle = 0;
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    if (this.phase === 'idle') return;
    this.detector.stop();
    this.opponent.stop();
    if (this.phase !== 'ended') this.setPhase('ended');
  }

  private queueFrame(): void {
    if (!this.schedule) return;
    this.frameHandle = this.schedule(() => {
      this.step();
      if (this.phase === 'active') this.queueFrame();
    });
  }

  private setPhase(phase: ControllerPhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    for (const listener of this.phaseListeners) listener(phase);
  }
}
