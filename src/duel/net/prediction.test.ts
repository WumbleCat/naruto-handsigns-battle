import { DUEL_CONFIG } from '@jutsu-duel/duel-shared';
import { describe, expect, it } from 'vitest';
import { correctTowards, InputHistory, replayUnacked, SnapshotBuffer } from './prediction';

describe('replayUnacked', () => {
  it('advances the server position by the unacknowledged inputs with the shared step', () => {
    const history = new InputHistory();
    for (let seq = 1; seq <= 6; seq += 1) history.push({ seq, moveX: 1, moveY: 0 });
    const predicted = replayUnacked({ x: 100, y: 350 }, history.after(3), 1);
    expect(predicted.x).toBeCloseTo(100 + (DUEL_CONFIG.player.speed * 3) / DUEL_CONFIG.tickRate, 6);
    expect(predicted.y).toBe(350);
  });

  it('halves the step while casting and respects the arena bounds', () => {
    const inputs = [{ seq: 1, moveX: -1, moveY: 0 }];
    expect(replayUnacked({ x: 30, y: 350 }, inputs, 0.5).x).toBeCloseTo(30 - 110 / 30, 6);
    expect(replayUnacked({ x: 22, y: 350 }, inputs, 1).x).toBe(22);
  });

  it('forgets inputs beyond its capacity', () => {
    const history = new InputHistory(3);
    for (let seq = 1; seq <= 5; seq += 1) history.push({ seq, moveX: 0, moveY: 0 });
    expect(history.after(0).map((s) => s.seq)).toEqual([3, 4, 5]);
  });
});

describe('correctTowards', () => {
  it('eases small errors and snaps large ones', () => {
    expect(
      correctTowards({ x: 0, y: 0 }, { x: 10, y: 0 }, { snapDistance: 80, easing: 0.5 }),
    ).toEqual({ x: 5, y: 0 });
    expect(
      correctTowards({ x: 0, y: 0 }, { x: 500, y: 0 }, { snapDistance: 80, easing: 0.5 }),
    ).toEqual({ x: 500, y: 0 });
  });
});

describe('SnapshotBuffer', () => {
  it('interpolates between snapshots and clamps outside them', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(1000, { x: 0, y: 0 });
    buffer.push(1100, { x: 100, y: 50 });
    expect(buffer.sample(1050)).toEqual({ x: 50, y: 25 });
    expect(buffer.sample(900)).toEqual({ x: 0, y: 0 });
    expect(buffer.sample(2000)).toEqual({ x: 100, y: 50 });
    expect(new SnapshotBuffer().sample(0)).toBeNull();
  });
});
