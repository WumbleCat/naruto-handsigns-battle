// The bot plays through the same request functions as a player, so these tests run whole
// matches on the pure simulation: bot against bot, and bot against a scripted opponent.
import { describe, expect, it } from 'vitest';
import { applyBotIntent, assessThreat, DuelBot } from './bot.ts';
import { BOT_PARAMS, DT_MS, DUEL_CONFIG as C, JUTSUS } from './config.ts';
import {
  addPlayer,
  beginCountdown,
  createDuelSim,
  createPlayerSim,
  getPlayer,
  observeSign,
  setReady,
  stepDuel,
  type DuelEvent,
  type DuelSim,
  type ProjectileSim,
} from './simulation.ts';
import { BOT_LEVELS, type BotLevel } from './types.ts';

const A = 'bot-a';
const B = 'bot-b';

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

interface MatchLog {
  sim: DuelSim;
  events: DuelEvent[];
}

/** Runs a full match. `drive` acts for a seat that has no bot. */
function playMatch(bots: DuelBot[], drive?: (sim: DuelSim, nowMs: number) => void): MatchLog {
  const sim = playing();
  const events: DuelEvent[] = [];
  let ticks = 0;
  while (sim.phase === 'PLAYING') {
    const nowMs = ticks * DT_MS;
    for (const bot of bots) {
      events.push(...applyBotIntent(sim, bot.id, bot.think(sim, nowMs), nowMs));
    }
    drive?.(sim, nowMs);
    events.push(...stepDuel(sim));
    ticks += 1;
  }
  return { sim, events };
}

function wins(levelA: BotLevel, levelB: BotLevel, matches: number): { a: number; b: number } {
  const score = { a: 0, b: 0 };
  for (let seed = 1; seed <= matches; seed += 1) {
    const { sim } = playMatch([new DuelBot(A, levelA, seed), new DuelBot(B, levelB, seed + 1000)]);
    if (sim.winnerId === A) score.a += 1;
    if (sim.winnerId === B) score.b += 1;
  }
  return score;
}

/** A stand-in for a player weaving at the webcam: stands still and casts Fireball on repeat. */
function stationaryCaster(id: string) {
  let nextAt = 0;
  return (sim: DuelSim, nowMs: number) => {
    if (nowMs < nextAt) return;
    nextAt = nowMs + 400;
    const me = getPlayer(sim, id);
    if (me) observeSign(sim, id, JUTSUS.fireball.signs[me.signIndex] ?? 'tiger', nowMs);
  };
}

/** Share of the scripted caster's projectiles that cost the bot HP. */
function hitRateAgainst(level: BotLevel): number {
  let thrown = 0;
  let landed = 0;
  for (let seed = 1; seed <= 30; seed += 1) {
    const { events } = playMatch([new DuelBot(A, level, seed)], stationaryCaster(B));
    for (const event of events) {
      if (event.type === 'CAST_RELEASED' && event.actorId === B) thrown += 1;
      if (event.type === 'HIT' && event.targetId === A && event.damage > 0) landed += 1;
    }
  }
  return landed / Math.max(1, thrown);
}

describe('assessThreat', () => {
  const me = { ...createPlayerSim(A, 'Alpha', 1), x: 600, y: 350 };
  const shot = (over: Partial<ProjectileSim>): ProjectileSim => ({
    id: 1,
    ownerId: B,
    jutsuId: 'fireball',
    x: 900,
    y: 350,
    vx: -500,
    vy: 0,
    radius: 24,
    damage: 28,
    expiresTick: 999,
    ...over,
  });

  it('reports a projectile on course, with the time left and a sideways escape', () => {
    const threat = assessThreat(shot({}), me);
    expect(threat).not.toBeNull();
    expect(threat?.timeToImpactMs).toBeCloseTo(((300 - 46) / 500) * 1000, 3);
    expect(threat?.escape.x).toBeCloseTo(0, 6);
    expect(Math.abs(threat?.escape.y ?? 0)).toBeCloseTo(1, 6);
  });

  it('ignores projectiles that will pass wide or are flying away', () => {
    expect(assessThreat(shot({ y: 350 + 46 + 40 }), me)).toBeNull();
    expect(assessThreat(shot({ vx: 500 }), me)).toBeNull();
  });

  it('escapes into the arena when the short way out is through a wall', () => {
    const cornered = { ...me, y: C.player.radius + 2 };
    const threat = assessThreat(shot({ y: cornered.y + 5 }), cornered);
    expect(threat?.escape.y).toBeCloseTo(1, 6);
  });
});

describe('DuelBot', () => {
  it('replays the same match from the same seeds', () => {
    const run = () => playMatch([new DuelBot(A, 'hard', 7), new DuelBot(B, 'normal', 8)]);
    const first = run();
    const second = run();
    expect(second.events).toEqual(first.events);
    expect(second.sim.winnerId).toBe(first.sim.winnerId);
  });

  it.each(BOT_LEVELS)('the %s bot casts jutsu within the resource rules', (level) => {
    const sim = playing();
    const bot = new DuelBot(A, level, 3);
    let casts = 0;
    for (let tick = 0; tick < 60 * C.tickRate && sim.phase === 'PLAYING'; tick += 1) {
      const nowMs = tick * DT_MS;
      const events = applyBotIntent(sim, A, bot.think(sim, nowMs), nowMs);
      casts += events.filter((event) => event.type === 'CAST_STARTED').length;
      stepDuel(sim);
      const me = getPlayer(sim, A);
      expect(me?.chakra).toBeGreaterThanOrEqual(0);
      expect(me?.stamina).toBeGreaterThanOrEqual(0);
    }
    expect(casts).toBeGreaterThan(0);
  });

  it('weaves no faster than the sign gap allows', () => {
    const sim = playing();
    const bot = new DuelBot(A, 'hard', 11);
    let last = -Infinity;
    let signs = 0;
    for (let tick = 0; tick < 30 * C.tickRate && sim.phase === 'PLAYING'; tick += 1) {
      const nowMs = tick * DT_MS;
      const intent = bot.think(sim, nowMs);
      if (intent.sign) {
        expect(nowMs - last).toBeGreaterThanOrEqual(C.signs.minGapMs);
        last = nowMs;
        signs += 1;
      }
      applyBotIntent(sim, A, intent, nowMs);
      stepDuel(sim);
    }
    expect(signs).toBeGreaterThan(3);
    for (const level of BOT_LEVELS) {
      const { signIntervalMs, signJitterMs } = BOT_PARAMS[level];
      expect(signIntervalMs - signJitterMs).toBeGreaterThanOrEqual(C.signs.minGapMs);
    }
  });

  it('ranks the levels: hard beats normal beats easy', () => {
    const hardVsNormal = wins('hard', 'normal', 30);
    const normalVsEasy = wins('normal', 'easy', 30);
    const hardVsEasy = wins('hard', 'easy', 30);
    expect(hardVsNormal.a).toBeGreaterThan(hardVsNormal.b * 1.5);
    expect(normalVsEasy.a).toBeGreaterThan(normalVsEasy.b * 1.5);
    expect(hardVsEasy.a).toBeGreaterThan(hardVsEasy.b * 3);
  });

  it('harder bots evade more of what is thrown at them', () => {
    const easy = hitRateAgainst('easy');
    const normal = hitRateAgainst('normal');
    const hard = hitRateAgainst('hard');
    expect(normal).toBeLessThan(easy);
    expect(hard).toBeLessThan(normal);
  });
});
