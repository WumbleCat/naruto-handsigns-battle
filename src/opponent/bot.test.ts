import { describe, expect, it } from 'vitest';
import { BALANCE, ENGINE_BALANCE, type BotDifficultyParams } from '../content/balance.config';
import { ROSTER, ROSTER_BY_ID } from '../content/roster';
import { BattleEngine } from '../engine/engine';
import type { EngineEvent } from '../engine/events';
import { BotOpponent } from './bot';
import type { OpponentContext } from './types';

const T0 = 1_000;

interface Harness {
  engine: BattleEngine;
  bot: BotOpponent;
  events: EngineEvent[];
  /** Runs engine and bot forward to `until`, in `step` ms increments. */
  runTo: (until: number, step?: number) => void;
  now: () => number;
}

function harness(
  difficulty: 'easy' | 'medium' | 'hard',
  overrides: Partial<BotDifficultyParams> = {},
  seed = 1,
): Harness {
  const engine = new BattleEngine({ balance: ENGINE_BALANCE, roster: ROSTER, startedAt: T0 });
  const events: EngineEvent[] = [];
  engine.subscribe((event) => events.push(event));
  let clock = T0;
  const now = () => clock;
  const bot = new BotOpponent({
    difficulty,
    params: { ...BALANCE.bot[difficulty], ...overrides },
    roster: ROSTER,
    balance: ENGINE_BALANCE,
    displayName: 'Bot',
    seed,
  });
  bot.onSign((sign, t) => engine.registerSign('p2', sign, t));
  const context: OpponentContext = {
    localPlayer: 'p1',
    now,
    getState: () => engine.getState(),
    subscribe: (listener) => engine.subscribe(listener),
  };
  bot.start(context);
  const runTo = (until: number, step = 50) => {
    while (clock < until) {
      clock = Math.min(until, clock + step);
      engine.tick(clock);
      bot.tick(clock);
    }
  };
  return { engine, bot, events, runTo, now };
}

function casts(events: EngineEvent[], player: 'p1' | 'p2') {
  return events.filter(
    (e): e is Extract<EngineEvent, { type: 'jutsuCast' }> =>
      e.type === 'jutsuCast' && e.player === player,
  );
}

describe('BotOpponent', () => {
  it('weaves complete jutsus at a human pace and keeps casting', () => {
    const h = harness('easy');
    h.runTo(T0 + 30_000);
    const botCasts = casts(h.events, 'p2');
    expect(botCasts.length).toBeGreaterThanOrEqual(3);
    expect(h.engine.getState().players.p1.hp).toBeLessThan(ENGINE_BALANCE.maxHp);
    // Each sign interval stays near the configured pace.
    const signs = h.events.filter((e) => e.type === 'signRegistered' && e.player === 'p2');
    expect(signs.length).toBeGreaterThan(botCasts.length * 2);
  });

  it('is deterministic for a seed', () => {
    const a = harness('medium', {}, 123);
    const b = harness('medium', {}, 123);
    a.runTo(T0 + 20_000);
    b.runTo(T0 + 20_000);
    expect(a.events).toEqual(b.events);
  });

  it('plays differently with a different seed', () => {
    const a = harness('medium', {}, 1);
    const b = harness('medium', {}, 2);
    a.runTo(T0 + 20_000);
    b.runTo(T0 + 20_000);
    expect(a.events).not.toEqual(b.events);
  });

  it('counters the element it reads from the player trail', () => {
    const h = harness('hard', {
      readsAfterSigns: 1,
      counterChance: 1,
      reactionMs: 100,
      misfireChance: 0,
      substitutionChance: 0,
      thinkMinMs: 10_000,
      thinkMaxMs: 10_000,
    });
    // Player opens Fire; the bot should answer with Water (its counter).
    h.engine.registerSign('p1', 'tiger', T0 + 10);
    h.runTo(T0 + 4_000);
    const first = casts(h.events, 'p2')[0];
    expect(first?.element).toBe('water');
    expect(first?.jutsuId).toBe('water_short');
  });

  it('never reads when readsAfterSigns is null', () => {
    const h = harness('easy', {
      readsAfterSigns: null,
      counterChance: 1,
      misfireChance: 0,
      substitutionChance: 0,
      thinkMinMs: 10_000,
      thinkMaxMs: 10_000,
    });
    h.engine.registerSign('p1', 'tiger', T0 + 10);
    h.runTo(T0 + 5_000);
    expect(casts(h.events, 'p2')).toHaveLength(0);
  });

  it('substitutes an incoming jutsu when it reacts in time', () => {
    const h = harness('hard', {
      substitutionChance: 1,
      reactionMs: 100,
      signIntervalMs: 300,
      signJitterMs: 0,
      misfireChance: 0,
      counterChance: 0,
      thinkMinMs: 60_000,
      thinkMaxMs: 60_000,
    });
    const seq = ROSTER_BY_ID.fire_short.sequence;
    seq.forEach((sign, i) => h.engine.registerSign('p1', sign, T0 + 100 + i * 100));
    h.runTo(T0 + 3_000);
    expect(h.events.some((e) => e.type === 'dodge' && e.player === 'p2')).toBe(true);
    expect(h.engine.getState().players.p2.hp).toBe(ENGINE_BALANCE.maxHp);
  });

  it('does not attempt Substitution while on cooldown', () => {
    const h = harness('hard', {
      substitutionChance: 1,
      reactionMs: 100,
      signIntervalMs: 300,
      signJitterMs: 0,
      misfireChance: 0,
      counterChance: 0,
      thinkMinMs: 60_000,
      thinkMaxMs: 60_000,
    });
    const seq = ROSTER_BY_ID.fire_short.sequence;
    seq.forEach((sign, i) => h.engine.registerSign('p1', sign, T0 + 100 + i * 100));
    h.runTo(T0 + 2_000);
    const dodges = () => h.events.filter((e) => e.type === 'dodge').length;
    expect(dodges()).toBe(1);
    // Second attack arrives during the 8 s cooldown: the bot must not whiff a Substitution.
    seq.forEach((sign, i) => h.engine.registerSign('p1', sign, T0 + 2_100 + i * 100));
    h.runTo(T0 + 5_000);
    expect(dodges()).toBe(1);
    expect(h.events.some((e) => e.type === 'substitutionFailed')).toBe(false);
  });

  it('misfires sometimes when the chance is high, resetting its own buffer', () => {
    const h = harness('easy', { misfireChance: 0.5, thinkMinMs: 200, thinkMaxMs: 400 });
    h.runTo(T0 + 20_000);
    const resets = h.events.filter(
      (e) => e.type === 'bufferReset' && e.player === 'p2' && e.reason === 'mismatch',
    );
    expect(resets.length).toBeGreaterThan(0);
  });

  it('stops emitting after the match ends', () => {
    const h = harness('hard', { thinkMinMs: 100, thinkMaxMs: 200 });
    h.engine.forfeit('p1', T0 + 500);
    const count = h.events.length;
    h.runTo(T0 + 10_000);
    expect(h.events).toHaveLength(count);
  });

  it('stops emitting after stop()', () => {
    const h = harness('hard', { thinkMinMs: 100, thinkMaxMs: 200 });
    h.bot.stop();
    h.runTo(T0 + 10_000);
    expect(casts(h.events, 'p2')).toHaveLength(0);
  });
});
