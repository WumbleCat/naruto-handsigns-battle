// Practice progress against one target sequence (docs/FRONTEND_DESIGN.md 6.7). Pure: no
// React, no timers. Same reset rules as the battle buffer so practice teaches real timing.
import type { SignId } from '../../engine/types';

export interface PracticeStats {
  attempts: number;
  completed: number;
  bestMs: number | null;
  lastMs: number | null;
}

export type PracticeEvent =
  | { type: 'progress'; index: number }
  | { type: 'miss'; sign: SignId; restarted: boolean }
  | { type: 'complete'; elapsedMs: number }
  | { type: 'timeout' }
  | { type: 'ignored' };

export class PracticeTracker {
  readonly sequence: readonly SignId[];
  private readonly resetMs: number;
  private readonly ignoreRepeated: boolean;
  private progress = 0;
  private startedAt: number | null = null;
  private lastAt: number | null = null;
  private lastSign: SignId | null = null;
  private stats: PracticeStats = { attempts: 0, completed: 0, bestMs: null, lastMs: null };

  constructor(sequence: readonly SignId[], options: { resetMs: number; ignoreRepeated?: boolean }) {
    if (sequence.length === 0) throw new Error('PracticeTracker needs a non-empty sequence');
    this.sequence = sequence;
    this.resetMs = options.resetMs;
    this.ignoreRepeated = options.ignoreRepeated ?? true;
  }

  /** Number of signs matched so far. */
  getProgress(): number {
    return this.progress;
  }

  getStats(): PracticeStats {
    return { ...this.stats };
  }

  /** Milliseconds since the first sign of the current attempt, or null when idle. */
  elapsed(now: number): number | null {
    return this.startedAt === null ? null : Math.max(0, now - this.startedAt);
  }

  /** Expire a stalled attempt. Call every frame. */
  tick(now: number): PracticeEvent | null {
    if (this.progress === 0 || this.lastAt === null) return null;
    if (now - this.lastAt < this.resetMs) return null;
    this.stats.attempts += 1;
    this.clear();
    return { type: 'timeout' };
  }

  register(sign: SignId, t: number): PracticeEvent {
    const expired = this.tick(t);
    if (this.ignoreRepeated && sign === this.lastSign && this.progress > 0) {
      return expired ?? { type: 'ignored' };
    }
    this.lastSign = sign;
    const expected = this.sequence[this.progress];

    if (sign === expected) {
      if (this.progress === 0) this.startedAt = t;
      this.progress += 1;
      this.lastAt = t;
      if (this.progress === this.sequence.length) {
        const elapsedMs = t - (this.startedAt ?? t);
        this.stats.attempts += 1;
        this.stats.completed += 1;
        this.stats.lastMs = elapsedMs;
        this.stats.bestMs =
          this.stats.bestMs === null ? elapsedMs : Math.min(this.stats.bestMs, elapsedMs);
        this.clear();
        return { type: 'complete', elapsedMs };
      }
      return { type: 'progress', index: this.progress };
    }

    if (this.progress > 0) this.stats.attempts += 1;
    const restarted = sign === this.sequence[0];
    this.progress = restarted ? 1 : 0;
    this.startedAt = restarted ? t : null;
    this.lastAt = restarted ? t : null;
    return { type: 'miss', sign, restarted };
  }

  /** Abandon the current attempt without counting it. */
  restart(): void {
    this.clear();
  }

  private clear(): void {
    this.progress = 0;
    this.startedAt = null;
    this.lastAt = null;
    this.lastSign = null;
  }
}
