import type { SignId } from './types';

/** One detector observation. `sign` is 'none' when no pose is recognised. */
export interface SignFrame {
  t: number;
  sign: SignId | 'none';
  confidence: number;
  /** Full class vector from the classifier, for debug readouts. Absent for the keyboard. */
  probabilities?: Float32Array;
}

export interface StabilizerOptions {
  /** How long the same sign must be seen continuously before it registers. */
  holdMs: number;
  /** Frames below this confidence count as 'none'. */
  threshold: number;
}

/**
 * Turns noisy per-frame predictions into registered signs (docs/DESIGN.md 5.3 rule 1).
 * A sign registers once held above the threshold for `holdMs`; after it registers, the same
 * sign cannot register again until a different sign or 'none' has been observed.
 */
export class SignStabilizer {
  private holdMs: number;
  private threshold: number;
  private candidate: SignId | null = null;
  private candidateSince = 0;
  private lastRegistered: SignId | null = null;
  private released = true;

  constructor(options: StabilizerOptions) {
    this.holdMs = options.holdMs;
    this.threshold = options.threshold;
  }

  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }

  setHoldMs(holdMs: number): void {
    this.holdMs = holdMs;
  }

  /** The sign currently being held, and how far along the hold is (0..1). For UI meters. */
  progress(now: number): { sign: SignId | null; fraction: number } {
    if (!this.candidate || (this.candidate === this.lastRegistered && !this.released)) {
      return { sign: this.candidate, fraction: this.candidate ? 1 : 0 };
    }
    return {
      sign: this.candidate,
      fraction: Math.max(0, Math.min(1, (now - this.candidateSince) / this.holdMs)),
    };
  }

  /** Feed one frame. Returns the sign that registered on this frame, or null. */
  observe(frame: SignFrame): SignId | null {
    const sign = frame.sign !== 'none' && frame.confidence >= this.threshold ? frame.sign : null;

    if (sign === null) {
      this.candidate = null;
      this.released = true;
      return null;
    }

    if (sign !== this.candidate) {
      this.candidate = sign;
      this.candidateSince = frame.t;
      if (sign !== this.lastRegistered) this.released = true;
    }

    if (sign === this.lastRegistered && !this.released) return null;

    if (frame.t - this.candidateSince >= this.holdMs) {
      this.lastRegistered = sign;
      this.released = false;
      return sign;
    }
    return null;
  }

  reset(): void {
    this.candidate = null;
    this.candidateSince = 0;
    this.lastRegistered = null;
    this.released = true;
  }
}
