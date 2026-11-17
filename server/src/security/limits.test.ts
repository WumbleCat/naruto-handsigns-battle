import { describe, expect, it } from 'vitest';
import { RecentIds, TokenBucket } from './limits.ts';

describe('TokenBucket', () => {
  it('allows a burst then refills at the rate', () => {
    const bucket = new TokenBucket(10, 3, 0);
    expect([bucket.take(0), bucket.take(0), bucket.take(0), bucket.take(0)]).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(bucket.take(99)).toBe(false);
    expect(bucket.take(100)).toBe(true);
  });
});

describe('RecentIds', () => {
  it('rejects repeats and forgets the oldest beyond its capacity', () => {
    const recent = new RecentIds(2);
    expect(recent.add('a')).toBe(true);
    expect(recent.add('a')).toBe(false);
    expect(recent.add('b')).toBe(true);
    expect(recent.add('c')).toBe(true);
    expect(recent.add('a')).toBe(true);
  });
});
