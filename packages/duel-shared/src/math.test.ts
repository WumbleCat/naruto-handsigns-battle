import { describe, expect, it } from 'vitest';
import { exitFraction, normalise, sweptCircleHit } from './math.ts';

describe('normalise', () => {
  it('returns a unit vector and treats zero as zero', () => {
    const d = normalise(1, 1);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1, 9);
    expect(normalise(0, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('sweptCircleHit', () => {
  it('finds the entry fraction of a segment crossing a circle', () => {
    const t = sweptCircleHit({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, 10);
    expect(t).toBeCloseTo(0.4, 6);
  });

  it('detects a crossing even when neither end point is inside (U-16)', () => {
    expect(sweptCircleHit({ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 1500, y: 5 }, 34)).not.toBeNull();
  });

  it('returns 0 when the start is already inside and null when the path misses', () => {
    expect(sweptCircleHit({ x: 50, y: 0 }, { x: 60, y: 0 }, { x: 50, y: 0 }, 10)).toBe(0);
    expect(sweptCircleHit({ x: 0, y: 50 }, { x: 100, y: 50 }, { x: 50, y: 0 }, 10)).toBeNull();
    expect(sweptCircleHit({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 50, y: 0 }, 10)).toBeNull();
  });
});

describe('exitFraction', () => {
  it('reports where a path leaves the arena and null when it stays inside', () => {
    expect(exitFraction({ x: 1190, y: 350 }, { x: 1210, y: 350 }, 1200, 700)).toBeCloseTo(0.5, 6);
    expect(exitFraction({ x: 10, y: 350 }, { x: -10, y: 350 }, 1200, 700)).toBeCloseTo(0.5, 6);
    expect(exitFraction({ x: 100, y: 100 }, { x: 200, y: 200 }, 1200, 700)).toBeNull();
  });
});
