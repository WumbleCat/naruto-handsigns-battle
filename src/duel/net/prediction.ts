// Client-side prediction and interpolation, pure so it can be unit tested. The local player
// replays inputs the server has not acknowledged on top of the authoritative position using
// the shared movement step; remote players are shown ~100 ms behind the newest patch.
import { DT, stepWalk, type Vec2 } from '@jutsu-duel/duel-shared';

export interface InputSample {
  seq: number;
  moveX: number;
  moveY: number;
}

/** Keeps the last `capacity` inputs sent, by sequence number. */
export class InputHistory {
  private readonly samples: InputSample[] = [];
  private readonly capacity: number;

  constructor(capacity = 64) {
    this.capacity = capacity;
  }

  push(sample: InputSample): void {
    this.samples.push(sample);
    if (this.samples.length > this.capacity) this.samples.shift();
  }

  /** Inputs with a sequence number after `acked`, oldest first. */
  after(acked: number): InputSample[] {
    return this.samples.filter((s) => s.seq > acked);
  }

  clear(): void {
    this.samples.length = 0;
  }
}

/** The authoritative position plus every input the server has not applied yet. */
export function replayUnacked(
  serverPosition: Vec2,
  unacked: readonly InputSample[],
  speedMultiplier: number,
): Vec2 {
  let position = serverPosition;
  for (const input of unacked) {
    position = stepWalk(position, input, DT, { speedMultiplier });
  }
  return position;
}

export interface CorrectionOptions {
  /** Errors above this many units snap instead of easing. */
  snapDistance: number;
  /** Fraction of the remaining error removed per frame when easing. */
  easing: number;
}

/** Moves the displayed position toward the predicted one: smooth for small errors, snap for large. */
export function correctTowards(displayed: Vec2, target: Vec2, options: CorrectionOptions): Vec2 {
  const dx = target.x - displayed.x;
  const dy = target.y - displayed.y;
  if (Math.hypot(dx, dy) > options.snapDistance) return { x: target.x, y: target.y };
  return { x: displayed.x + dx * options.easing, y: displayed.y + dy * options.easing };
}

interface Snapshot extends Vec2 {
  t: number;
}

/** Timestamped positions of a remote entity, sampled behind the newest one for smooth motion. */
export class SnapshotBuffer {
  private readonly snapshots: Snapshot[] = [];
  private readonly keepMs: number;

  constructor(keepMs = 1000) {
    this.keepMs = keepMs;
  }

  push(t: number, position: Vec2): void {
    const last = this.snapshots[this.snapshots.length - 1];
    if (last && last.t === t) {
      last.x = position.x;
      last.y = position.y;
    } else {
      this.snapshots.push({ t, x: position.x, y: position.y });
    }
    while (
      this.snapshots.length > 2 &&
      this.snapshots[0] !== undefined &&
      t - this.snapshots[0].t > this.keepMs
    ) {
      this.snapshots.shift();
    }
  }

  /** Position at `renderTime`, interpolated between the two surrounding snapshots. */
  sample(renderTime: number): Vec2 | null {
    const list = this.snapshots;
    if (list.length === 0) return null;
    const first = list[0];
    const last = list[list.length - 1];
    if (!first || !last) return null;
    if (renderTime <= first.t) return { x: first.x, y: first.y };
    if (renderTime >= last.t) return { x: last.x, y: last.y };
    for (let i = 1; i < list.length; i += 1) {
      const a = list[i - 1];
      const b = list[i];
      if (!a || !b) continue;
      if (renderTime <= b.t) {
        const span = b.t - a.t;
        const f = span > 0 ? (renderTime - a.t) / span : 1;
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      }
    }
    return { x: last.x, y: last.y };
  }

  clear(): void {
    this.snapshots.length = 0;
  }
}
