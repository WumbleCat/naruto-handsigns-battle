import { describe, expect, it } from 'vitest';
import { Prng } from './prng';

describe('Prng', () => {
  it('is deterministic for a seed', () => {
    const a = new Prng(42);
    const b = new Prng(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs between seeds', () => {
    expect(new Prng(1).next()).not.toBe(new Prng(2).next());
  });

  it('stays within [0, 1) and respects ranges', () => {
    const rng = new Prng(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      const ranged = rng.range(10, 20);
      expect(ranged).toBeGreaterThanOrEqual(10);
      expect(ranged).toBeLessThan(20);
    }
  });

  it('honours probabilities roughly', () => {
    const rng = new Prng(99);
    let hits = 0;
    for (let i = 0; i < 10_000; i += 1) if (rng.chance(0.3)) hits += 1;
    expect(hits / 10_000).toBeGreaterThan(0.27);
    expect(hits / 10_000).toBeLessThan(0.33);
  });

  it('picks from a list and refuses an empty one', () => {
    const rng = new Prng(3);
    expect(['a', 'b', 'c']).toContain(rng.pick(['a', 'b', 'c']));
    expect(() => rng.pick([])).toThrow();
  });
});
