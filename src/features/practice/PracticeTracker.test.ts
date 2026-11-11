import { describe, expect, it } from 'vitest';
import { ROSTER_BY_ID } from '../../content/roster';
import { PracticeTracker } from './PracticeTracker';

const SEQ = ROSTER_BY_ID.fire_short.sequence; // tiger, horse, rat
const RESET = 2_500;

describe('PracticeTracker', () => {
  it('advances through the sequence and completes with the elapsed time', () => {
    const tracker = new PracticeTracker(SEQ, { resetMs: RESET });
    expect(tracker.register('tiger', 1_000)).toEqual({ type: 'progress', index: 1 });
    expect(tracker.register('horse', 1_600)).toEqual({ type: 'progress', index: 2 });
    expect(tracker.elapsed(2_000)).toBe(1_000);
    expect(tracker.register('rat', 2_300)).toEqual({ type: 'complete', elapsedMs: 1_300 });
    expect(tracker.getProgress()).toBe(0);
    expect(tracker.getStats()).toEqual({ attempts: 1, completed: 1, bestMs: 1_300, lastMs: 1_300 });
  });

  it('keeps the best time across attempts', () => {
    const tracker = new PracticeTracker(SEQ, { resetMs: RESET });
    SEQ.forEach((sign, i) => tracker.register(sign, 1_000 + i * 500));
    SEQ.forEach((sign, i) => tracker.register(sign, 5_000 + i * 300));
    expect(tracker.getStats()).toMatchObject({ completed: 2, bestMs: 600, lastMs: 600 });
  });

  it('counts a wrong sign as a failed attempt and restarts from an opener', () => {
    const tracker = new PracticeTracker(SEQ, { resetMs: RESET });
    tracker.register('tiger', 1_000);
    expect(tracker.register('snake', 1_500)).toEqual({
      type: 'miss',
      sign: 'snake',
      restarted: false,
    });
    expect(tracker.getProgress()).toBe(0);
    expect(tracker.getStats().attempts).toBe(1);
    tracker.register('tiger', 2_000);
    expect(tracker.register('tiger', 2_600)).toEqual({ type: 'ignored' });
    expect(tracker.register('horse', 2_700)).toEqual({ type: 'progress', index: 2 });
    // Wrong sign that happens to be the opener: the attempt fails but a new one starts.
    expect(tracker.register('tiger', 2_800)).toEqual({
      type: 'miss',
      sign: 'tiger',
      restarted: true,
    });
    expect(tracker.getProgress()).toBe(1);
    expect(tracker.getStats().attempts).toBe(2);
    // A wrong non-opener from the idle state is a miss that stays idle.
    tracker.restart();
    expect(tracker.register('dog', 3_000)).toEqual({ type: 'miss', sign: 'dog', restarted: false });
    expect(tracker.getProgress()).toBe(0);
  });

  it('expires a stalled attempt after the reset time', () => {
    const tracker = new PracticeTracker(SEQ, { resetMs: RESET });
    tracker.register('tiger', 1_000);
    expect(tracker.tick(1_000 + RESET - 1)).toBeNull();
    expect(tracker.tick(1_000 + RESET)).toEqual({ type: 'timeout' });
    expect(tracker.getProgress()).toBe(0);
    expect(tracker.getStats().attempts).toBe(1);
    expect(tracker.elapsed(5_000)).toBeNull();
  });

  it('restart abandons without counting', () => {
    const tracker = new PracticeTracker(SEQ, { resetMs: RESET });
    tracker.register('tiger', 1_000);
    tracker.restart();
    expect(tracker.getProgress()).toBe(0);
    expect(tracker.getStats().attempts).toBe(0);
  });
});
