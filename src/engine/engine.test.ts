import { describe, expect, it } from 'vitest';
import { ENGINE_BALANCE } from '../content/balance.config';
import { ROSTER, ROSTER_BY_ID, type RosterJutsuId } from '../content/roster';
import { BattleEngine } from './engine';
import type { EngineEvent } from './events';
import type { EngineBalance, PlayerId } from './types';

const T0 = 10_000;
const STEP = 100;
const B = ENGINE_BALANCE;

function setup(overrides: Partial<EngineBalance> = {}) {
  const balance: EngineBalance = { ...B, ...overrides };
  const engine = new BattleEngine({ balance, roster: ROSTER, startedAt: T0 });
  const events: EngineEvent[] = [];
  engine.subscribe((event) => events.push(event));
  return { engine, events, balance };
}

/** Registers every sign of a jutsu, one per STEP, starting at `from`. Returns the cast time. */
function weave(engine: BattleEngine, player: PlayerId, id: RosterJutsuId, from: number) {
  const { sequence } = ROSTER_BY_ID[id];
  let t = from;
  sequence.forEach((sign, index) => {
    t = from + index * STEP;
    engine.registerSign(player, sign, t);
  });
  return t;
}

function types(events: EngineEvent[]): string[] {
  return events.map((event) => event.type);
}

function hits(events: EngineEvent[]) {
  return events.filter(
    (event): event is Extract<EngineEvent, { type: 'hit' }> => event.type === 'hit',
  );
}

describe('BattleEngine: construction', () => {
  it('starts both players at full HP with an empty buffer', () => {
    const { engine } = setup();
    const state = engine.getState();
    expect(state.phase).toBe('active');
    expect(state.players.p1.hp).toBe(B.maxHp);
    expect(state.players.p2.buffer).toEqual([]);
    expect(state.endsAt).toBe(T0 + B.roundDurationMs);
  });

  it('refuses a roster the balance cannot price', () => {
    expect(
      () =>
        new BattleEngine({
          balance: { ...B, damageBySignCount: { 3: 12 } },
          roster: ROSTER,
          startedAt: T0,
        }),
    ).toThrow(/damage table/);
  });

  it('returns the same snapshot object until something changes', () => {
    const { engine } = setup();
    const a = engine.getState();
    expect(engine.getState()).toBe(a);
    engine.registerSign('p1', 'tiger', T0 + 1);
    const b = engine.getState();
    expect(b).not.toBe(a);
    expect(b.players.p1.buffer).toEqual(['tiger']);
    expect(a.players.p1.buffer).toEqual([]);
  });
});

describe('BattleEngine: damage table', () => {
  it.each([
    ['fire_short', 12],
    ['earth_short', 18],
    ['wind_long', 26],
    ['water_long', 36],
  ] as const)('%s lands %i damage unanswered', (id, damage) => {
    const { engine, events } = setup();
    const castAt = weave(engine, 'p1', id, T0);
    engine.tick(castAt + B.flightMs);
    const [hit] = hits(events);
    expect(hit).toMatchObject({ target: 'p2', damage, hpAfter: B.maxHp - damage, viaClash: false });
  });
});

describe('BattleEngine: buffer', () => {
  it('extends the buffer along a valid prefix and emits each registration', () => {
    const { engine, events } = setup();
    engine.registerSign('p1', 'tiger', T0);
    engine.registerSign('p1', 'horse', T0 + STEP);
    expect(engine.getState().players.p1.buffer).toEqual(['tiger', 'horse']);
    expect(events).toEqual([
      { type: 'signRegistered', t: T0, player: 'p1', sign: 'tiger', buffer: ['tiger'] },
      {
        type: 'signRegistered',
        t: T0 + STEP,
        player: 'p1',
        sign: 'horse',
        buffer: ['tiger', 'horse'],
      },
    ]);
  });

  it('restarts from an opener on a mismatch', () => {
    const { engine, events } = setup();
    engine.registerSign('p1', 'tiger', T0);
    engine.registerSign('p1', 'snake', T0 + STEP);
    expect(engine.getState().players.p1.buffer).toEqual(['snake']);
    expect(types(events)).toEqual(['signRegistered', 'bufferReset', 'signRegistered']);
    expect(events[1]).toMatchObject({ type: 'bufferReset', reason: 'mismatch' });
  });

  it('clears the buffer on a mismatch with a non-opener', () => {
    const { engine } = setup();
    engine.registerSign('p1', 'tiger', T0);
    engine.registerSign('p1', 'dog', T0 + STEP);
    expect(engine.getState().players.p1.buffer).toEqual([]);
    expect(engine.getState().players.p1.bufferUpdatedAt).toBeNull();
  });

  it('ignores a sign identical to the last buffered sign', () => {
    const { engine, events } = setup();
    engine.registerSign('p1', 'tiger', T0);
    engine.registerSign('p1', 'tiger', T0 + STEP);
    expect(engine.getState().players.p1.buffer).toEqual(['tiger']);
    expect(events).toHaveLength(1);
  });

  it('resets after the timeout and not a millisecond before', () => {
    const { engine, events } = setup();
    engine.registerSign('p1', 'tiger', T0);
    engine.tick(T0 + B.bufferResetMs - 1);
    expect(engine.getState().players.p1.buffer).toEqual(['tiger']);
    engine.tick(T0 + B.bufferResetMs);
    expect(engine.getState().players.p1.buffer).toEqual([]);
    expect(events.at(-1)).toEqual({
      type: 'bufferReset',
      t: T0 + B.bufferResetMs,
      player: 'p1',
      reason: 'timeout',
    });
  });

  it('measures the timeout from the latest sign', () => {
    const { engine } = setup();
    engine.registerSign('p1', 'tiger', T0);
    engine.registerSign('p1', 'horse', T0 + 2000);
    engine.tick(T0 + B.bufferResetMs + 1000);
    expect(engine.getState().players.p1.buffer).toEqual(['tiger', 'horse']);
    engine.tick(T0 + 2000 + B.bufferResetMs);
    expect(engine.getState().players.p1.buffer).toEqual([]);
  });

  it('casts automatically when the buffer completes a sequence', () => {
    const { engine, events } = setup();
    const castAt = weave(engine, 'p1', 'fire_short', T0);
    expect(engine.getState().players.p1.buffer).toEqual([]);
    expect(types(events).slice(-2)).toEqual(['bufferReset', 'jutsuCast']);
    expect(events.at(-1)).toMatchObject({
      type: 'jutsuCast',
      t: castAt,
      player: 'p1',
      jutsuId: 'fire_short',
      element: 'fire',
      landsAt: castAt + B.flightMs,
    });
    expect(engine.getState().inFlight).toHaveLength(1);
    expect(engine.getState().players.p1.stats.jutsusCast).toEqual({ fire_short: 1 });
  });
});

describe('BattleEngine: flight', () => {
  it('lands exactly at castAt + flightMs at 1.0x', () => {
    const { engine, events } = setup();
    const castAt = weave(engine, 'p1', 'fire_short', T0);
    engine.tick(castAt + B.flightMs - 1);
    expect(hits(events)).toHaveLength(0);
    expect(engine.getState().players.p2.hp).toBe(B.maxHp);
    engine.tick(castAt + B.flightMs);
    expect(hits(events)).toHaveLength(1);
    expect(engine.getState().players.p2.hp).toBe(B.maxHp - 12);
    expect(engine.getState().inFlight).toEqual([]);
  });

  it('lands a projectile even when the next input arrives long after', () => {
    const { engine, events } = setup();
    const castAt = weave(engine, 'p1', 'fire_short', T0);
    engine.registerSign('p2', 'snake', castAt + 5000);
    expect(hits(events)[0]?.t).toBe(castAt + B.flightMs);
  });
});

describe('BattleEngine: clash', () => {
  it('resolves instantly when the second jutsu is cast inside the flight window', () => {
    const { engine, events } = setup();
    const fireAt = weave(engine, 'p1', 'fire_short', T0);
    const waterAt = weave(engine, 'p2', 'water_short', fireAt + 200);
    expect(waterAt).toBeLessThan(fireAt + B.flightMs);

    const clash = events.find((e) => e.type === 'clash');
    expect(clash).toMatchObject({
      t: waterAt,
      a: { caster: 'p1', multiplier: B.clashDisadvantageMultiplier },
      b: { caster: 'p2', multiplier: B.clashAdvantageMultiplier },
    });
    expect(hits(events)).toEqual([
      expect.objectContaining({ target: 'p2', damage: 6, viaClash: true }),
      expect.objectContaining({ target: 'p1', damage: 18, viaClash: true }),
    ]);
    expect(types(events).slice(-3)).toEqual(['clash', 'hit', 'hit']);
    expect(engine.getState().inFlight).toEqual([]);
    expect(engine.getState().players.p2.stats.clashesWon).toBe(1);
    expect(engine.getState().players.p1.stats.clashesLost).toBe(1);
  });

  it('halves the disadvantaged newcomer and boosts the defender', () => {
    const { engine, events } = setup();
    const waterAt = weave(engine, 'p1', 'water_short', T0);
    weave(engine, 'p2', 'fire_short', waterAt + 200);
    expect(hits(events).map((h) => [h.target, h.damage])).toEqual([
      ['p2', 18],
      ['p1', 6],
    ]);
  });

  it('lands both at 1.0x on a neutral matchup', () => {
    const { engine, events } = setup();
    const fireAt = weave(engine, 'p1', 'fire_short', T0);
    weave(engine, 'p2', 'earth_short', fireAt + 200);
    expect(hits(events).map((h) => [h.target, h.damage])).toEqual([
      ['p2', 12],
      ['p1', 18],
    ]);
    expect(engine.getState().players.p1.stats.clashesWon).toBe(0);
    expect(engine.getState().players.p2.stats.clashesWon).toBe(0);
  });

  it('keeps every multiplied damage value a whole number for the shipped table', () => {
    for (const base of Object.values(B.damageBySignCount)) {
      expect(Number.isInteger(base * B.clashAdvantageMultiplier)).toBe(true);
      expect(Number.isInteger(base * B.clashDisadvantageMultiplier)).toBe(true);
    }
  });

  it('does not clash once the first projectile has landed', () => {
    const { engine, events } = setup();
    const fireAt = weave(engine, 'p1', 'fire_short', T0);
    weave(engine, 'p2', 'water_short', fireAt + B.flightMs);
    expect(events.some((e) => e.type === 'clash')).toBe(false);
    expect(hits(events)).toHaveLength(1);
    expect(engine.getState().inFlight).toHaveLength(1);
  });

  it('clashes with the oldest opposing projectile when several are in flight', () => {
    const { engine, events } = setup();
    // Keyboard-fast input: two p1 projectiles inside one flight window.
    const first = weave(engine, 'p1', 'fire_short', T0);
    const second = weave(engine, 'p1', 'wind_short', first + 10);
    expect(engine.getState().inFlight.map((p) => p.jutsuId)).toEqual(['fire_short', 'wind_short']);
    weave(engine, 'p2', 'water_short', second + 10);
    const clash = events.find((e) => e.type === 'clash');
    expect(clash).toMatchObject({ a: { projectileId: 1 } });
    expect(engine.getState().inFlight.map((p) => p.jutsuId)).toEqual(['wind_short']);
  });
});

describe('BattleEngine: substitution', () => {
  it('negates the oldest enemy projectile and starts the cooldown', () => {
    const { engine, events } = setup();
    const fireAt = weave(engine, 'p1', 'fire_short', T0);
    const subAt = weave(engine, 'p2', 'substitution', fireAt + 100);
    expect(events.at(-1)).toEqual({
      type: 'dodge',
      t: subAt,
      player: 'p2',
      negatedProjectileId: 1,
    });
    expect(engine.getState().inFlight).toEqual([]);
    engine.tick(fireAt + B.flightMs + 1);
    expect(hits(events)).toHaveLength(0);
    expect(engine.getState().players.p2.substitutionReadyAt).toBe(subAt + B.substitutionCooldownMs);
    expect(engine.getState().players.p2.stats.substitutions).toBe(1);
  });

  it('is ready again exactly when the cooldown ends, announced once', () => {
    const { engine, events } = setup();
    const fireAt = weave(engine, 'p1', 'fire_short', T0);
    const subAt = weave(engine, 'p2', 'substitution', fireAt + 100);
    engine.tick(subAt + B.substitutionCooldownMs - 1);
    expect(events.filter((e) => e.type === 'cooldownReady')).toHaveLength(0);
    engine.tick(subAt + B.substitutionCooldownMs);
    engine.tick(subAt + B.substitutionCooldownMs + 5000);
    expect(events.filter((e) => e.type === 'cooldownReady')).toEqual([
      { type: 'cooldownReady', t: subAt + B.substitutionCooldownMs, player: 'p2' },
    ]);
    expect(engine.getState().players.p2.substitutionReadyAt).toBe(0);
  });

  it('does nothing during the cooldown except reset the buffer', () => {
    const { engine, events } = setup();
    const fireAt = weave(engine, 'p1', 'fire_short', T0);
    const subAt = weave(engine, 'p2', 'substitution', fireAt + 100);
    const secondFireAt = weave(engine, 'p1', 'fire_short', subAt + 100);
    weave(engine, 'p2', 'substitution', secondFireAt + 100);
    expect(events.at(-1)).toMatchObject({ type: 'substitutionFailed', reason: 'cooldown' });
    expect(engine.getState().inFlight).toHaveLength(1);
    expect(engine.getState().players.p2.buffer).toEqual([]);
  });

  it('starts the cooldown on a whiff when the balance says so', () => {
    const { engine, events } = setup();
    const subAt = weave(engine, 'p2', 'substitution', T0);
    expect(events.at(-1)).toMatchObject({ type: 'substitutionFailed', reason: 'nothingInFlight' });
    expect(engine.getState().players.p2.substitutionReadyAt).toBe(subAt + B.substitutionCooldownMs);
  });

  it('leaves Substitution ready after a whiff when the balance says not', () => {
    const { engine } = setup({ substitutionWhiffTriggersCooldown: false });
    weave(engine, 'p2', 'substitution', T0);
    expect(engine.getState().players.p2.substitutionReadyAt).toBe(0);
  });
});

describe('BattleEngine: end of match', () => {
  it('ends with a KO and ignores inputs afterwards', () => {
    const { engine, events } = setup({ maxHp: 10 });
    const castAt = weave(engine, 'p1', 'fire_short', T0);
    engine.tick(castAt + B.flightMs);
    expect(types(events).slice(-3)).toEqual(['hit', 'ko', 'matchEnded']);
    expect(events.at(-1)).toEqual({
      type: 'matchEnded',
      t: castAt + B.flightMs,
      winner: 'p1',
      reason: 'ko',
    });
    expect(engine.getState().phase).toBe('ended');
    expect(engine.getState().players.p2.hp).toBe(0);

    const count = events.length;
    weave(engine, 'p2', 'water_short', castAt + B.flightMs + 100);
    engine.tick(castAt + 60_000);
    expect(events).toHaveLength(count);
  });

  it('declares a draw when both players reach zero in the same clash', () => {
    const { engine, events } = setup({ maxHp: 12 });
    const fireAt = weave(engine, 'p1', 'fire_short', T0);
    weave(engine, 'p2', 'earth_short', fireAt + 200);
    expect(types(events).slice(-6)).toEqual(['clash', 'hit', 'hit', 'ko', 'ko', 'matchEnded']);
    expect(events.at(-1)).toMatchObject({ type: 'matchEnded', winner: null });
  });

  it('declares a draw via matchEnded with no winner on a double KO', () => {
    const { engine, events } = setup({ maxHp: 12 });
    const fireAt = weave(engine, 'p1', 'fire_short', T0);
    weave(engine, 'p2', 'earth_short', fireAt + 200);
    const ended = events.find((e) => e.type === 'matchEnded');
    expect(ended).toMatchObject({ winner: null, reason: 'ko' });
    expect(engine.getState().result).toEqual({ winner: null, reason: 'ko' });
  });

  it('ends on the round timer with the healthier player winning', () => {
    const { engine, events } = setup({ roundDurationMs: 5_000 });
    const castAt = weave(engine, 'p1', 'fire_short', T0);
    engine.tick(castAt + B.flightMs);
    engine.tick(T0 + 4_999);
    expect(engine.getState().phase).toBe('active');
    engine.tick(T0 + 5_000);
    expect(events.at(-1)).toEqual({
      type: 'matchEnded',
      t: T0 + 5_000,
      winner: 'p1',
      reason: 'timeout',
    });
  });

  it('draws on the round timer with equal HP', () => {
    const { engine, events } = setup({ roundDurationMs: 5_000 });
    engine.tick(T0 + 9_000);
    expect(events.at(-1)).toEqual({
      type: 'matchEnded',
      t: T0 + 5_000,
      winner: null,
      reason: 'timeout',
    });
    expect(engine.getState().now).toBe(T0 + 5_000);
  });

  it('lets a projectile land at the final instant before the timer decides', () => {
    const { engine, events } = setup({ roundDurationMs: 2_000 + B.flightMs });
    weave(engine, 'p1', 'fire_short', T0 + 2_000 - 2 * STEP);
    engine.tick(T0 + 10_000);
    expect(types(events).slice(-2)).toEqual(['hit', 'matchEnded']);
    expect(events.at(-1)).toMatchObject({ winner: 'p1', reason: 'timeout' });
  });

  it('awards a forfeit to the other player', () => {
    const { engine, events } = setup();
    engine.forfeit('p2', T0 + 500);
    expect(events).toEqual([{ type: 'matchEnded', t: T0 + 500, winner: 'p1', reason: 'forfeit' }]);
    engine.forfeit('p1', T0 + 600);
    expect(events).toHaveLength(1);
  });
});

describe('BattleEngine: determinism and time', () => {
  function script(engine: BattleEngine) {
    const a = weave(engine, 'p1', 'fire_long', T0);
    weave(engine, 'p2', 'water_short', T0 + 300);
    engine.tick(a + 2000);
    weave(engine, 'p2', 'substitution', a + 2100);
    const b = weave(engine, 'p1', 'lightning_short', a + 2500);
    weave(engine, 'p2', 'wind_short', b + 100);
    engine.tick(b + 10_000);
  }

  it('produces identical event logs for identical input', () => {
    const first = setup();
    const second = setup();
    script(first.engine);
    script(second.engine);
    expect(first.events).toEqual(second.events);
    expect(first.engine.getState()).toEqual(second.engine.getState());
  });

  it('clamps inputs that arrive with an earlier timestamp than the engine clock', () => {
    const { engine, events } = setup();
    engine.tick(T0 + 1000);
    engine.registerSign('p1', 'tiger', T0 + 500);
    expect(events[0]).toMatchObject({ type: 'signRegistered', t: T0 + 1000 });
    expect(engine.getState().now).toBe(T0 + 1000);
  });

  it('tracks damage dealt and taken per player', () => {
    const { engine } = setup();
    const fireAt = weave(engine, 'p1', 'fire_short', T0);
    weave(engine, 'p2', 'water_short', fireAt + 200);
    const state = engine.getState();
    expect(state.players.p1.stats).toMatchObject({ damageDealt: 6, damageTaken: 18 });
    expect(state.players.p2.stats).toMatchObject({ damageDealt: 18, damageTaken: 6 });
  });
});
