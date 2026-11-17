// Rule tests mapped to the spec's minimum test table (U-01 to U-18) plus the ordering details.
import { describe, expect, it } from 'vitest';
import { DT_MS, DUEL_CONFIG as C, JUTSUS, msToTicks } from './config.ts';
import {
  addPlayer,
  beginCountdown,
  cancelSigns,
  createDuelSim,
  forfeit,
  getPlayer,
  isInvulnerable,
  observeSign,
  pauseForReconnect,
  requestDodge,
  resetForRematch,
  selectJutsu,
  setMoveInput,
  setReady,
  stepDuel,
  type DuelEvent,
  type DuelSim,
  type PlayerSim,
} from './simulation.ts';
import type { DuelSign } from './types.ts';

const A = 'player-a';
const B = 'player-b';

/** A match that has just entered PLAYING with both players at their spawns. */
function playing(): DuelSim {
  const sim = createDuelSim();
  addPlayer(sim, A, 'Alpha');
  addPlayer(sim, B, 'Beta');
  setReady(sim, A, true);
  setReady(sim, B, true);
  beginCountdown(sim);
  while (sim.phase === 'COUNTDOWN') stepDuel(sim);
  return sim;
}

function run(sim: DuelSim, ticks: number): DuelEvent[] {
  const events: DuelEvent[] = [];
  for (let i = 0; i < ticks; i += 1) events.push(...stepDuel(sim));
  return events;
}

function player(sim: DuelSim, id: string): PlayerSim {
  const p = getPlayer(sim, id);
  if (!p) throw new Error(`no player ${id}`);
  return p;
}

/** Feeds a full valid sequence with a comfortable gap between signs. */
function weave(sim: DuelSim, id: string, signs: readonly DuelSign[], startMs: number) {
  let last: ReturnType<typeof observeSign> | null = null;
  signs.forEach((sign, i) => {
    last = observeSign(sim, id, sign, startMs + i * 300);
  });
  return last as ReturnType<typeof observeSign> | null;
}

describe('lobby and phases', () => {
  it('seats exactly two players and never starts solo (U-19, U-25)', () => {
    const sim = createDuelSim();
    expect(addPlayer(sim, A, 'Alpha')?.slot).toBe(1);
    expect(addPlayer(sim, B, 'Beta')?.slot).toBe(2);
    expect(addPlayer(sim, 'c', 'Gamma')).toBeNull();
    const solo = createDuelSim();
    addPlayer(solo, A, 'Alpha');
    setReady(solo, A, true);
    expect(solo.phase).toBe('WAITING');
    run(solo, 200);
    expect(solo.phase).toBe('WAITING');
  });

  it('runs the countdown then plays for 180 s of ticks', () => {
    const sim = playing();
    expect(sim.phase).toBe('PLAYING');
    expect(sim.activeTicksRemaining).toBe(msToTicks(C.match.durationMs));
  });

  it('freezes everything while paused for a reconnect', () => {
    const sim = playing();
    player(sim, A).chakra = 50;
    pauseForReconnect(sim);
    const tick = sim.tick;
    run(sim, 100);
    expect(sim.tick).toBe(tick);
    expect(player(sim, A).chakra).toBe(50);
  });
});

describe('movement', () => {
  it('moves at the same speed diagonally as straight (U-01)', () => {
    const sim = playing();
    const a = player(sim, A);
    const b = player(sim, B);
    setMoveInput(sim, A, 1, 1);
    setMoveInput(sim, B, 0, 1);
    const ax = a.x;
    const ay = a.y;
    const by = b.y;
    run(sim, 30);
    expect(Math.hypot(a.x - ax, a.y - ay)).toBeCloseTo(C.player.speed, 3);
    expect(b.y - by).toBeCloseTo(C.player.speed, 3);
  });

  it('stays inside the arena when walking or dashing into a wall (U-02)', () => {
    const sim = playing();
    const a = player(sim, A);
    setMoveInput(sim, A, -1, -1);
    run(sim, 120);
    expect(a.x).toBe(C.player.radius);
    expect(a.y).toBe(C.player.radius);
    requestDodge(sim, A);
    run(sim, 10);
    expect(a.x).toBe(C.player.radius);
    expect(a.y).toBe(C.player.radius);
  });

  it('never lets the bodies overlap (U-03)', () => {
    const sim = playing();
    const a = player(sim, A);
    const b = player(sim, B);
    b.x = a.x + 60;
    b.y = a.y;
    setMoveInput(sim, A, 1, 0);
    setMoveInput(sim, B, -1, 0);
    run(sim, 30);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2 * C.player.radius - 1e-6);
  });

  it('walks at half speed while casting', () => {
    const sim = playing();
    const a = player(sim, A);
    weave(sim, A, JUTSUS.fireball.signs, 1000);
    setMoveInput(sim, A, 0, 1);
    const y = a.y;
    run(sim, 3);
    expect(a.y - y).toBeCloseTo((C.player.speed * 0.5 * 3) / C.tickRate, 3);
  });
});

describe('regeneration', () => {
  it('does not regenerate HP until 6 s after damage, then at 2 per second (U-04, U-05)', () => {
    const sim = playing();
    const a = player(sim, A);
    a.hp = 75;
    a.lastHpDamageTick = sim.tick;
    run(sim, msToTicks(5900));
    expect(a.hp).toBe(75);
    run(sim, msToTicks(C.resources.hpRegenDelayMs) - msToTicks(5900) + 30);
    expect(a.hp).toBeCloseTo(77, 1);
    a.hp = 99.9;
    run(sim, 60);
    expect(a.hp).toBe(100);
  });

  it('regenerates chakra 7/s and stamina 20/s (U-06)', () => {
    const sim = playing();
    const a = player(sim, A);
    a.chakra = 90;
    a.stamina = 90;
    run(sim, 30);
    expect(a.chakra).toBeCloseTo(97, 6);
    expect(a.stamina).toBe(100);
  });
});

describe('dodge', () => {
  it('rejects a dodge below 35 stamina without any side effect (U-07)', () => {
    const sim = playing();
    const a = player(sim, A);
    a.stamina = 34;
    const x = a.x;
    const { result } = requestDodge(sim, A);
    expect(result).toEqual({ ok: false, reason: 'insufficient_stamina' });
    run(sim, 3);
    expect(a.stamina).toBeCloseTo(34 + (20 * 3) / 30, 6);
    expect(a.x).toBe(x);
    expect(a.dodgeReadyTick).toBeLessThan(0);
  });

  it('costs 35 at once, holds stamina during the dash, covers 150 units and cools down 1.5 s (U-08)', () => {
    const sim = playing();
    const a = player(sim, A);
    a.stamina = 70;
    setMoveInput(sim, A, 1, 0);
    const x = a.x;
    expect(requestDodge(sim, A).result).toEqual({ ok: true });
    expect(a.stamina).toBe(35);
    run(sim, msToTicks(C.dodge.durationMs));
    expect(a.stamina).toBe(35);
    expect(a.x - x).toBeCloseTo(C.dodge.distance, 3);
    expect(requestDodge(sim, A).result).toEqual({ ok: false, reason: 'dodge_cooldown' });
    run(sim, msToTicks(C.dodge.cooldownMs) - msToTicks(C.dodge.durationMs) - 1);
    expect(requestDodge(sim, A).result).toEqual({ ok: false, reason: 'dodge_cooldown' });
    run(sim, 1);
    expect(requestDodge(sim, A).result).toEqual({ ok: true });
  });

  it('dashes away from the opponent when no direction is held', () => {
    const sim = playing();
    const a = player(sim, A);
    const x = a.x;
    requestDodge(sim, A);
    run(sim, 6);
    expect(a.x).toBeLessThan(x);
  });

  it('is invulnerable only between 30 and 150 ms after the dodge starts', () => {
    const sim = playing();
    const a = player(sim, A);
    requestDodge(sim, A);
    const start = a.dodgeStartsTick;
    const windowTicks = [];
    for (let t = start; t < start + 8; t += 1)
      if (isInvulnerable(a, t)) windowTicks.push(t - start);
    expect(windowTicks).toEqual([1, 2, 3, 4]);
    expect(windowTicks.every((t) => t * DT_MS >= 30 && t * DT_MS <= 150)).toBe(true);
  });
});

describe('projectiles and shields', () => {
  /** Places a live fireball so that it reaches B on the next tick. */
  function incomingFireball(sim: DuelSim, targetId: string) {
    const target = player(sim, targetId);
    const jutsu = JUTSUS.fireball;
    if (jutsu.kind !== 'projectile') throw new Error('fireball is a projectile');
    sim.projectiles.push({
      id: sim.nextProjectileId++,
      ownerId: targetId === A ? B : A,
      jutsuId: 'fireball',
      x: target.x - (C.player.radius + jutsu.radius) - 10,
      y: target.y,
      vx: jutsu.speed,
      vy: 0,
      radius: jutsu.radius,
      damage: jutsu.damage,
      expiresTick: sim.tick + 100,
    });
  }

  it('consumes a projectile without damage during i-frames (U-09)', () => {
    const sim = playing();
    const b = player(sim, B);
    requestDodge(sim, B);
    run(sim, 1); // tick offset 1: 33 ms after the dodge started
    b.x = 600;
    b.dodgeRemaining = 0;
    incomingFireball(sim, B);
    const events = run(sim, 1);
    const hit = events.find((e) => e.type === 'HIT');
    expect(hit).toMatchObject({ type: 'HIT', targetId: B, dodged: true, damage: 0 });
    expect(b.hp).toBe(100);
    expect(sim.projectiles).toHaveLength(0);
    expect(b.stats.dodgesSuccessful).toBe(1);
  });

  it('deals normal damage just outside the i-frame window (U-10)', () => {
    const sim = playing();
    const b = player(sim, B);
    requestDodge(sim, B);
    run(sim, 5); // tick offset 5: 167 ms, i-frames over
    b.dodgeRemaining = 0;
    incomingFireball(sim, B);
    run(sim, 1);
    expect(b.hp).toBe(72);
  });

  it('spends the shield before HP (U-11)', () => {
    const sim = playing();
    const b = player(sim, B);
    b.hp = 80;
    b.shieldHp = 15;
    b.shieldExpiresTick = sim.tick + 50;
    incomingFireball(sim, B);
    const events = run(sim, 1);
    expect(b.shieldHp).toBe(0);
    expect(b.hp).toBe(67);
    expect(events.find((e) => e.type === 'HIT')).toMatchObject({ damage: 13, shieldAbsorbed: 15 });
    expect(b.lastHpDamageTick).toBe(sim.tick - 1);
  });

  it('does not reset the HP regen timer when the shield absorbs everything', () => {
    const sim = playing();
    const b = player(sim, B);
    b.shieldHp = 38;
    b.shieldExpiresTick = sim.tick + 50;
    incomingFireball(sim, B);
    run(sim, 1);
    expect(b.hp).toBe(100);
    expect(b.shieldHp).toBe(10);
    expect(b.lastHpDamageTick).toBeLessThan(0);
  });

  it('casts the shield through its signs and expires it after 2.5 s', () => {
    const sim = playing();
    const a = player(sim, A);
    selectJutsu(sim, A, 'water_shield');
    const last = weave(sim, A, JUTSUS.water_shield.signs, 1000);
    expect(last?.result).toMatchObject({ ok: true, cast: { ok: true } });
    expect(a.chakra).toBe(75);
    // The wind-up occupies castMs worth of ticks; the release lands on the tick after them.
    const events = run(sim, msToTicks(JUTSUS.water_shield.castMs) + 1);
    expect(events.find((e) => e.type === 'SHIELD_ON')).toBeDefined();
    expect(a.shieldHp).toBe(38);
    expect(run(sim, msToTicks(2500) - 1).find((e) => e.type === 'SHIELD_OFF')).toBeUndefined();
    expect(a.shieldHp).toBe(38);
    const more = run(sim, 1);
    expect(more.find((e) => e.type === 'SHIELD_OFF')).toBeDefined();
    expect(a.shieldHp).toBe(0);
  });

  it('detects a fast projectile crossing a player between ticks (U-16)', () => {
    const sim = playing();
    const b = player(sim, B);
    sim.projectiles.push({
      id: 99,
      ownerId: A,
      jutsuId: 'lightning_spear',
      x: b.x - 500,
      y: b.y,
      vx: 30_000, // 1000 units per tick: both end points are far from the target
      vy: 0,
      radius: 12,
      damage: 40,
      expiresTick: sim.tick + 10,
    });
    run(sim, 1);
    expect(b.hp).toBe(60);
  });

  it('expires projectiles that leave the arena or run out of lifetime', () => {
    const sim = playing();
    sim.projectiles.push({
      id: 1,
      ownerId: A,
      jutsuId: 'fireball',
      x: 1195,
      y: 100,
      vx: 500,
      vy: 0,
      radius: 24,
      damage: 28,
      expiresTick: sim.tick + 100,
    });
    sim.projectiles.push({
      id: 2,
      ownerId: A,
      jutsuId: 'fireball',
      x: 600,
      y: 100,
      vx: 0,
      vy: 0,
      radius: 24,
      damage: 28,
      expiresTick: sim.tick + 1,
    });
    const events = run(sim, 1);
    expect(events.filter((e) => e.type === 'PROJECTILE_EXPIRED')).toHaveLength(2);
    expect(sim.projectiles).toHaveLength(0);
  });
});

describe('signs and casting', () => {
  it('starts a Fireball cast after Tiger, Boar, Horse and releases a projectile (U-12)', () => {
    const sim = playing();
    const a = player(sim, A);
    const last = weave(sim, A, JUTSUS.fireball.signs, 1000);
    expect(last?.result).toMatchObject({ ok: true, index: 3, required: 3, cast: { ok: true } });
    expect(a.chakra).toBe(70);
    expect(a.castJutsuId).toBe('fireball');
    expect(
      run(sim, msToTicks(JUTSUS.fireball.castMs)).find((e) => e.type === 'CAST_RELEASED'),
    ).toBeUndefined();
    const events = run(sim, 1);
    expect(events.find((e) => e.type === 'CAST_RELEASED')).toMatchObject({ jutsuId: 'fireball' });
    expect(sim.projectiles).toHaveLength(1);
    expect(sim.projectiles[0]?.x).toBeGreaterThan(a.x);
  });

  it('resets on a wrong sign, refuses too-fast signs, and times out slow sequences (U-13)', () => {
    const sim = playing();
    const a = player(sim, A);
    expect(observeSign(sim, A, 'tiger', 1000).result).toMatchObject({ ok: true, index: 1 });
    expect(observeSign(sim, A, 'rat', 1300).result).toMatchObject({
      ok: false,
      reason: 'wrong_sign',
      index: 0,
    });
    expect(observeSign(sim, A, 'tiger', 1600).result).toMatchObject({ ok: true, index: 1 });
    expect(observeSign(sim, A, 'boar', 1650).result).toMatchObject({
      ok: false,
      reason: 'sign_too_fast',
      index: 1,
    });
    expect(observeSign(sim, A, 'boar', 6000).result).toMatchObject({
      ok: false,
      reason: 'sign_timeout',
      index: 0,
    });
    expect(a.chakra).toBe(100);
    expect(a.castJutsuId).toBe('');
  });

  it('rejects a cast without chakra and keeps the chakra (U-14)', () => {
    const sim = playing();
    const a = player(sim, A);
    a.chakra = 20;
    const last = weave(sim, A, JUTSUS.fireball.signs, 1000);
    expect(last?.result).toMatchObject({
      ok: true,
      cast: { ok: false, reason: 'insufficient_chakra' },
    });
    expect(a.chakra).toBe(20);
    expect(a.castJutsuId).toBe('');
    expect(a.signIndex).toBe(0);
  });

  it('rejects an immediate recast by cooldown (U-15)', () => {
    const sim = playing();
    weave(sim, A, JUTSUS.fireball.signs, 1000);
    run(sim, msToTicks(JUTSUS.fireball.castMs) + 1);
    const again = weave(sim, A, JUTSUS.fireball.signs, 3000);
    expect(again?.result).toMatchObject({
      ok: true,
      cast: { ok: false, reason: 'jutsu_cooldown' },
    });
  });

  it('locks the selection while a sequence is in progress and frees it on cancel', () => {
    const sim = playing();
    observeSign(sim, A, 'tiger', 1000);
    expect(selectJutsu(sim, A, 'water_shield')).toEqual({
      ok: false,
      reason: 'sequence_in_progress',
    });
    cancelSigns(sim, A);
    expect(selectJutsu(sim, A, 'water_shield')).toEqual({ ok: true });
  });

  it('cannot dodge mid-cast and cannot cast mid-dodge', () => {
    const sim = playing();
    weave(sim, A, JUTSUS.fireball.signs, 1000);
    expect(requestDodge(sim, A).result).toEqual({ ok: false, reason: 'casting' });
    const sim2 = playing();
    requestDodge(sim2, A);
    const last = weave(sim2, A, JUTSUS.fireball.signs, 1000);
    expect(last?.result).toMatchObject({ cast: { ok: false, reason: 'already_dodging' } });
  });

  it('spawns nothing when the caster dies during the wind-up', () => {
    const sim = playing();
    const a = player(sim, A);
    weave(sim, A, JUTSUS.fireball.signs, 1000);
    a.hp = 0;
    a.alive = false;
    const events = run(sim, msToTicks(JUTSUS.fireball.castMs));
    expect(events.find((e) => e.type === 'CAST_RELEASED')).toBeUndefined();
    expect(sim.projectiles).toHaveLength(0);
  });
});

describe('outcomes', () => {
  it('ends in a draw when both players die on the same tick (U-17)', () => {
    const sim = playing();
    for (const id of [A, B]) {
      const p = player(sim, id);
      p.hp = 10;
      sim.projectiles.push({
        id: sim.nextProjectileId++,
        ownerId: id === A ? B : A,
        jutsuId: 'fireball',
        x: p.x + (id === A ? -60 : 60),
        y: p.y,
        vx: id === A ? 500 : -500,
        vy: 0,
        radius: 24,
        damage: 28,
        expiresTick: sim.tick + 100,
      });
    }
    const events = run(sim, 1);
    expect(sim.phase).toBe('FINISHED');
    expect(sim.resultReason).toBe('draw');
    expect(sim.winnerId).toBe('');
    expect(events.filter((e) => e.type === 'KO')).toHaveLength(2);
  });

  it('awards the timeout to the higher HP and draws on equal HP (U-18)', () => {
    const sim = playing();
    player(sim, A).hp = 80;
    player(sim, B).hp = 60;
    sim.activeTicksRemaining = 3;
    run(sim, 3);
    expect(sim.phase).toBe('FINISHED');
    expect(sim.winnerId).toBe(A);
    expect(sim.resultReason).toBe('timeout');

    const even = playing();
    even.activeTicksRemaining = 1;
    run(even, 1);
    expect(even.resultReason).toBe('draw');
  });

  it('declares a KO winner and ignores later input', () => {
    const sim = playing();
    const b = player(sim, B);
    b.hp = 5;
    sim.projectiles.push({
      id: 1,
      ownerId: A,
      jutsuId: 'fireball',
      x: b.x - 60,
      y: b.y,
      vx: 500,
      vy: 0,
      radius: 24,
      damage: 28,
      expiresTick: sim.tick + 100,
    });
    run(sim, 1);
    expect(sim.winnerId).toBe(A);
    expect(sim.resultReason).toBe('ko');
    expect(requestDodge(sim, A).result).toEqual({ ok: false, reason: 'not_playing' });
  });

  it('forfeits to the opponent and resets fully on rematch (U-24)', () => {
    const sim = playing();
    player(sim, A).chakra = 10;
    player(sim, A).hp = 40;
    requestDodge(sim, B);
    expect(forfeit(sim, A)).toMatchObject({ type: 'MATCH_ENDED', winnerId: B, reason: 'forfeit' });
    resetForRematch(sim);
    expect(sim.phase).toBe('COUNTDOWN');
    const a = player(sim, A);
    const b = player(sim, B);
    expect([a.hp, a.chakra, a.stamina, b.stamina]).toEqual([100, 100, 100, 100]);
    expect(b.dodgeReadyTick).toBeLessThan(0);
    expect(sim.projectiles).toHaveLength(0);
    expect(sim.winnerId).toBe('');
  });
});
