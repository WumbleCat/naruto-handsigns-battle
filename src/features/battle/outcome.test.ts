import { describe, expect, it } from 'vitest';
import { ENGINE_BALANCE } from '../../content/balance.config';
import { ROSTER, ROSTER_BY_ID } from '../../content/roster';
import { BattleEngine } from '../../engine/engine';
import { buildOutcome } from './outcome';

const T0 = 2_000;

function finishedEngine() {
  const engine = new BattleEngine({
    balance: { ...ENGINE_BALANCE, maxHp: 20 },
    roster: ROSTER,
    startedAt: T0,
  });
  ROSTER_BY_ID.fire_short.sequence.forEach((sign, i) =>
    engine.registerSign('p1', sign, T0 + i * 100),
  );
  engine.tick(T0 + 200 + ENGINE_BALANCE.flightMs);
  ROSTER_BY_ID.water_short.sequence.forEach((sign, i) =>
    engine.registerSign('p2', sign, T0 + 3_000 + i * 100),
  );
  engine.tick(T0 + 3_200 + ENGINE_BALANCE.flightMs);
  ROSTER_BY_ID.fire_short.sequence.forEach((sign, i) =>
    engine.registerSign('p1', sign, T0 + 6_000 + i * 100),
  );
  engine.tick(T0 + 6_200 + ENGINE_BALANCE.flightMs);
  return engine;
}

describe('buildOutcome', () => {
  it('summarises a win from the local player side', () => {
    const engine = finishedEngine();
    const state = engine.getState();
    expect(state.phase).toBe('ended');
    const outcome = buildOutcome(state, 'p1');
    expect(outcome).toEqual({
      result: 'win',
      endReason: 'ko',
      durationSeconds: 8,
      playerHpLeft: 8,
      opponentHpLeft: 0,
      damageDealt: 24,
      damageTaken: 12,
      clashesWon: 0,
      clashesLost: 0,
      substitutions: 0,
      jutsusUsed: { fire_short: 2 },
    });
  });

  it('reads as a loss from the other side', () => {
    const outcome = buildOutcome(finishedEngine().getState(), 'p2');
    expect(outcome.result).toBe('loss');
    expect(outcome.playerHpLeft).toBe(0);
    expect(outcome.jutsusUsed).toEqual({ water_short: 1 });
  });

  it('refuses an unfinished match', () => {
    const engine = new BattleEngine({ balance: ENGINE_BALANCE, roster: ROSTER, startedAt: T0 });
    expect(() => buildOutcome(engine.getState(), 'p1')).toThrow();
  });
});
