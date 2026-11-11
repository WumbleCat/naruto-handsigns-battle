// Wires a detector and the stabiliser to a PracticeTracker, outside React, so the page only
// calls methods and subscribes to events (the same shape as the BattleController).
import type { SignDetector, SignFrame } from '../../detection/types';
import { SignStabilizer } from '../../engine/stabilizer';
import type { SignId } from '../../engine/types';
import type { HoldState } from '../battle/BattleController';
import type { PracticeEvent, PracticeTracker } from './PracticeTracker';

export type PracticeInputEvent = PracticeEvent | { type: 'registered'; sign: SignId };

export interface PracticeInputOptions<D extends SignDetector = SignDetector> {
  detector: D;
  tracker: PracticeTracker | null;
  holdMs: number;
  threshold: number;
  now?: () => number;
}

export class PracticeInput<D extends SignDetector = SignDetector> {
  readonly tracker: PracticeTracker | null;
  /** Public so the page can hand a webcam detector its landmark frames. */
  readonly detector: D;
  private readonly stabilizer: SignStabilizer;
  private readonly now: () => number;
  private lastFrame: SignFrame | null = null;
  private lastRegistered: SignId | null = null;
  private off: (() => void) | null = null;
  private readonly listeners = new Set<(event: PracticeInputEvent) => void>();

  constructor(options: PracticeInputOptions<D>) {
    this.detector = options.detector;
    this.tracker = options.tracker;
    this.stabilizer = new SignStabilizer({ holdMs: options.holdMs, threshold: options.threshold });
    this.now = options.now ?? (() => performance.now());
  }

  async start(): Promise<void> {
    this.off ??= this.detector.onFrame(this.onFrame);
    await this.detector.start();
  }

  stop(): void {
    this.off?.();
    this.off = null;
    this.detector.stop();
  }

  onEvent(listener: (event: PracticeInputEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Expire a stalled attempt; call every frame. */
  tick(now: number): void {
    const event = this.tracker?.tick(now) ?? null;
    if (event) this.emit(event);
  }

  getHold(now: number): HoldState {
    const progress = this.stabilizer.progress(now);
    const frame = this.lastFrame;
    const confidence = frame && frame.sign === progress.sign ? frame.confidence : 0;
    return { sign: progress.sign, fraction: progress.fraction, confidence };
  }

  /** The last sign that registered, for free practice. */
  getLastRegistered(): SignId | null {
    return this.lastRegistered;
  }

  restart(): void {
    this.tracker?.restart();
    this.stabilizer.reset();
  }

  private onFrame = (frame: SignFrame): void => {
    this.lastFrame = frame;
    const t = this.now();
    const sign = this.stabilizer.observe({ ...frame, t });
    if (!sign) return;
    this.lastRegistered = sign;
    this.emit({ type: 'registered', sign });
    if (this.tracker) this.emit(this.tracker.register(sign, t));
  };

  private emit(event: PracticeInputEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
