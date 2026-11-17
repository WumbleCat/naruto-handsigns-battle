// Per-connection abuse guards: token buckets for discrete actions and a bounded memory of
// recent action / event ids so a resent packet is applied once.

export class TokenBucket {
  private tokens: number;
  private lastMs: number;
  private readonly ratePerMs: number;
  private readonly burst: number;

  constructor(ratePerSecond: number, burst: number, nowMs: number) {
    this.ratePerMs = ratePerSecond / 1000;
    this.burst = burst;
    this.tokens = burst;
    this.lastMs = nowMs;
  }

  /** Takes one token if available. */
  take(nowMs: number): boolean {
    const elapsed = Math.max(0, nowMs - this.lastMs);
    this.lastMs = nowMs;
    this.tokens = Math.min(this.burst, this.tokens + elapsed * this.ratePerMs);
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

export class RecentIds {
  private readonly ids: string[] = [];
  private readonly set = new Set<string>();
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  /** Records the id; false when it was already seen. */
  add(id: string): boolean {
    if (this.set.has(id)) return false;
    this.set.add(id);
    this.ids.push(id);
    if (this.ids.length > this.capacity) {
      const oldest = this.ids.shift();
      if (oldest !== undefined) this.set.delete(oldest);
    }
    return true;
  }
}
