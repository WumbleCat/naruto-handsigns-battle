// The bot opponent for offline duels. It is a pure decision function over the simulation: each
// tick `think` returns an intent, and `applyBotIntent` turns that intent into the same requests
// a player's client sends (move, dodge, select, sign). The bot therefore cannot break a rule,
// skip a cooldown or weave faster than the sign gap allows. All randomness comes from a seeded
// PRNG and time arrives as a parameter, so a match replays exactly from its seed.
import { BOT_PARAMS, BOT_TUNING as T, DT_MS, DUEL_CONFIG as C, JUTSUS } from './config.ts';
import type { BotParams, JutsuDef } from './config.ts';
import { distance, normalise, type Vec2 } from './math.ts';
import { Prng } from './prng.ts';
import {
  cancelSigns,
  getOpponent,
  getPlayer,
  isCasting,
  isDodging,
  observeSign,
  requestDodge,
  selectJutsu,
  setMoveInput,
  type DuelEvent,
  type DuelSim,
  type PlayerSim,
  type ProjectileSim,
} from './simulation.ts';
import { DUEL_SIGNS, JUTSU_IDS, type BotLevel, type DuelSign, type JutsuId } from './types.ts';

/** What the bot wants to do this tick, in the vocabulary of the client messages. */
export interface BotIntent {
  moveX: number;
  moveY: number;
  dodge: boolean;
  cancelSigns: boolean;
  select: JutsuId | null;
  sign: DuelSign | null;
}

interface Plan {
  jutsuId: JutsuId;
  nextSignAt: number;
  /** When the last sign first became due, for the hard bot's wait for an opening. */
  readySince: number | null;
}

interface Threat {
  timeToImpactMs: number;
  /** Unit vector that leaves the projectile's path the short way (and stays in the arena). */
  escape: Vec2;
}

interface Reaction {
  evade: boolean;
  actAt: number;
}

const IDLE: BotIntent = {
  moveX: 0,
  moveY: 0,
  dodge: false,
  cancelSigns: false,
  select: null,
  sign: null,
};

const PROJECTILE_JUTSU: readonly JutsuDef[] = JUTSU_IDS.map((id) => JUTSUS[id]).filter(
  (jutsu) => jutsu.kind === 'projectile',
);

function insideArena(point: Vec2): boolean {
  const r = C.player.radius;
  return (
    point.x >= r && point.x <= C.arena.width - r && point.y >= r && point.y <= C.arena.height - r
  );
}

/** Whether `projectile` is on course to hit `me`, and how to get out of its way. */
export function assessThreat(projectile: ProjectileSim, me: PlayerSim): Threat | null {
  const speed = Math.hypot(projectile.vx, projectile.vy);
  if (speed < 1e-6) return null;
  const dir = { x: projectile.vx / speed, y: projectile.vy / speed };
  const relX = me.x - projectile.x;
  const relY = me.y - projectile.y;
  const along = relX * dir.x + relY * dir.y;
  if (along < 0) return null;
  const perp = { x: dir.y, y: -dir.x };
  const across = relX * perp.x + relY * perp.y;
  const reach = C.player.radius + projectile.radius + T.threatMarginUnits;
  if (Math.abs(across) > reach) return null;
  const side = across >= 0 ? 1 : -1;
  const near = reach - Math.abs(across);
  let escape = { x: perp.x * side, y: perp.y * side };
  if (!insideArena({ x: me.x + escape.x * near, y: me.y + escape.y * near })) {
    escape = { x: -escape.x, y: -escape.y };
  }
  const gap = Math.max(0, along - (reach - T.threatMarginUnits));
  return { timeToImpactMs: (gap / speed) * 1000, escape };
}

export class DuelBot {
  readonly id: string;
  readonly level: BotLevel;
  readonly params: BotParams;
  private readonly rng: Prng;
  private plan: Plan | null = null;
  private nextPlanAt: number | null = null;
  private lastSignAt = -Infinity;
  private strafeUntil = -Infinity;
  private strafeSign: 1 | -1 = 1;
  private resting = false;
  private readonly reactions = new Map<number, Reaction>();
  private seenWindUpEndsTick = -1;
  private shieldAt: number | null = null;

  constructor(id: string, level: BotLevel, seed: number) {
    this.id = id;
    this.level = level;
    this.params = BOT_PARAMS[level];
    this.rng = new Prng(seed);
  }

  /** Forgets the current match (plans, reactions) but keeps the random stream going. */
  reset(): void {
    this.plan = null;
    this.nextPlanAt = null;
    this.lastSignAt = -Infinity;
    this.strafeUntil = -Infinity;
    this.resting = false;
    this.reactions.clear();
    this.seenWindUpEndsTick = -1;
    this.shieldAt = null;
  }

  /** One decision. `nowMs` is match time; call once per simulation tick while playing. */
  think(sim: DuelSim, nowMs: number): BotIntent {
    const me = getPlayer(sim, this.id);
    const foe = getOpponent(sim, this.id);
    if (sim.phase !== 'PLAYING' || !me || !foe || !me.alive) return IDLE;
    this.nextPlanAt ??= nowMs + this.thinkTime();

    const intent: BotIntent = { ...IDLE };
    const busy = isCasting(me, sim.tick) || isDodging(me, sim.tick);

    this.watchWindUp(sim, me, foe, nowMs);
    const threat = this.urgentThreat(sim, me, nowMs);
    intent.dodge =
      threat !== null &&
      !busy &&
      threat.timeToImpactMs <= T.dodgeLeadMs &&
      me.stamina >= C.dodge.staminaCost &&
      sim.tick >= me.dodgeReadyTick;
    // A sign in the tick a dodge starts could finish a sequence the dodge then refuses to cast.
    if (!busy && !intent.dodge) this.weave(sim, me, foe, nowMs, intent);
    const move = threat ? threat.escape : this.movement(me, foe, nowMs);
    intent.moveX = move.x;
    intent.moveY = move.y;
    return intent;
  }

  // ---- defence ---------------------------------------------------------------------------

  /** The soonest projectile the bot has decided to evade and has had time to react to. */
  private urgentThreat(sim: DuelSim, me: PlayerSim, nowMs: number): Threat | null {
    const live = new Set<number>();
    let urgent: Threat | null = null;
    for (const projectile of sim.projectiles) {
      if (projectile.ownerId === this.id) continue;
      live.add(projectile.id);
      let reaction = this.reactions.get(projectile.id);
      if (!reaction) {
        reaction = {
          evade: this.rng.chance(this.params.evadeChance),
          actAt: nowMs + this.params.reactionMs,
        };
        this.reactions.set(projectile.id, reaction);
      }
      if (!reaction.evade || nowMs < reaction.actAt) continue;
      const threat = assessThreat(projectile, me);
      if (threat && (!urgent || threat.timeToImpactMs < urgent.timeToImpactMs)) urgent = threat;
    }
    for (const id of [...this.reactions.keys()]) {
      if (!live.has(id)) this.reactions.delete(id);
    }
    return urgent;
  }

  /** Decides once per opponent wind-up whether to answer it with the shield. */
  private watchWindUp(sim: DuelSim, me: PlayerSim, foe: PlayerSim, nowMs: number): void {
    const winding =
      isCasting(foe, sim.tick) &&
      foe.castJutsuId !== '' &&
      JUTSUS[foe.castJutsuId].kind !== 'shield';
    if (winding && foe.castEndsTick !== this.seenWindUpEndsTick) {
      this.seenWindUpEndsTick = foe.castEndsTick;
      if (this.rng.chance(this.params.shieldChance) && this.canCast(sim, me, 'water_shield')) {
        this.shieldAt = nowMs + this.params.reactionMs;
      }
    }
    if (this.shieldAt === null || nowMs < this.shieldAt) return;
    this.shieldAt = null;
    if (me.shieldHp > 0 || !this.canCast(sim, me, 'water_shield')) return;
    this.plan = { jutsuId: 'water_shield', nextSignAt: nowMs, readySince: null };
  }

  // ---- offence ---------------------------------------------------------------------------

  private weave(sim: DuelSim, me: PlayerSim, foe: PlayerSim, nowMs: number, out: BotIntent): void {
    if (!this.plan) {
      if (this.nextPlanAt === null || nowMs < this.nextPlanAt) return;
      const jutsuId = this.chooseAttack(sim, me);
      if (!jutsuId) {
        this.nextPlanAt = nowMs + T.retryMs;
        return;
      }
      this.plan = { jutsuId, nextSignAt: nowMs + this.interval(), readySince: null };
    }
    const plan = this.plan;
    if (!this.canCast(sim, me, plan.jutsuId)) {
      this.dropPlan(nowMs + T.retryMs);
      return;
    }
    const jutsu = JUTSUS[plan.jutsuId];
    let index = me.signIndex;
    if (me.selectedJutsuId !== plan.jutsuId) {
      out.cancelSigns = me.signIndex > 0;
      out.select = plan.jutsuId;
      index = 0;
    }
    const gapOk = nowMs - this.lastSignAt >= C.signs.minGapMs + DT_MS;
    if (nowMs < plan.nextSignAt || !gapOk) return;

    const expected = jutsu.signs[index];
    if (expected === undefined) return;
    const isLast = index === jutsu.signs.length - 1;
    if (isLast && jutsu.kind === 'projectile' && this.params.holdForOpeningMs > 0) {
      plan.readySince ??= nowMs;
      const waited = nowMs - plan.readySince;
      if (!this.isOpening(sim, me, foe) && waited < this.params.holdForOpeningMs) return;
    }

    this.lastSignAt = nowMs;
    if (this.rng.chance(this.params.misfireChance)) {
      out.sign = this.wrongSign(expected);
      this.dropPlan(nowMs + this.params.thinkMinMs);
      return;
    }
    out.sign = expected;
    if (isLast) this.dropPlan(nowMs + this.thinkTime());
    else plan.nextSignAt = nowMs + this.interval();
  }

  /** A moment when a projectile aimed now is likely to land. */
  private isOpening(sim: DuelSim, me: PlayerSim, foe: PlayerSim): boolean {
    if (isCasting(foe, sim.tick)) return true;
    if (Math.hypot(foe.vx, foe.vy) < T.stillSpeed) return true;
    return distance(me, foe) < T.pointBlankUnits;
  }

  private chooseAttack(sim: DuelSim, me: PlayerSim): JutsuId | null {
    const ready = PROJECTILE_JUTSU.filter((jutsu) => this.canCast(sim, me, jutsu.id));
    if (ready.length === 0) return null;
    const byCost = [...ready].sort((a, b) => a.chakra - b.chakra);
    const pick = this.rng.chance(this.params.heavyChance) ? byCost[byCost.length - 1] : byCost[0];
    return pick?.id ?? null;
  }

  private canCast(sim: DuelSim, me: PlayerSim, jutsuId: JutsuId): boolean {
    return me.chakra >= JUTSUS[jutsuId].chakra && sim.tick >= me.cooldownReadyTick[jutsuId];
  }

  private dropPlan(nextPlanAt: number): void {
    this.plan = null;
    this.nextPlanAt = nextPlanAt;
  }

  private wrongSign(expected: DuelSign): DuelSign {
    const others = DUEL_SIGNS.filter((sign) => sign !== expected);
    return others[Math.floor(this.rng.next() * others.length)] ?? expected;
  }

  // ---- movement --------------------------------------------------------------------------

  /** Holds the preferred distance band and strafes across the opponent's line of fire. */
  private movement(me: PlayerSim, foe: PlayerSim, nowMs: number): Vec2 {
    if (this.plan && !this.params.movesWhileWeaving) return { x: 0, y: 0 };
    if (nowMs >= this.strafeUntil) {
      this.strafeUntil = nowMs + this.rng.range(this.params.strafeMinMs, this.params.strafeMaxMs);
      this.resting = this.rng.chance(this.params.restChance);
      this.strafeSign = this.rng.chance(0.5) ? 1 : -1;
    }
    if (this.resting) return { x: 0, y: 0 };
    const toFoe = normalise(foe.x - me.x, foe.y - me.y);
    const gap = distance(me, foe);
    const radial = gap > this.params.rangeMax ? 1 : gap < this.params.rangeMin ? -1 : 0;
    let tangent = { x: -toFoe.y * this.strafeSign, y: toFoe.x * this.strafeSign };
    // Strafing into a wall would pin the bot in place; turn around instead.
    if (!insideArena({ x: me.x + tangent.x * 40, y: me.y + tangent.y * 40 })) {
      this.strafeSign = this.strafeSign === 1 ? -1 : 1;
      tangent = { x: -tangent.x, y: -tangent.y };
    }
    const weight = radial === 0 ? 1 : 0.6;
    return normalise(toFoe.x * radial + tangent.x * weight, toFoe.y * radial + tangent.y * weight);
  }

  private interval(): number {
    const { signIntervalMs, signJitterMs } = this.params;
    return signIntervalMs + this.rng.range(-signJitterMs, signJitterMs);
  }

  private thinkTime(): number {
    return this.rng.range(this.params.thinkMinMs, this.params.thinkMaxMs);
  }
}

/**
 * Feeds an intent into the simulation through the request functions a room uses for a player.
 * Returns the events those requests produced (a dodge or a cast starting).
 */
export function applyBotIntent(
  sim: DuelSim,
  botId: string,
  intent: BotIntent,
  nowMs: number,
): DuelEvent[] {
  const events: DuelEvent[] = [];
  setMoveInput(sim, botId, intent.moveX, intent.moveY);
  if (intent.dodge) {
    const { event } = requestDodge(sim, botId);
    if (event) events.push(event);
  }
  if (intent.cancelSigns) cancelSigns(sim, botId);
  if (intent.select) selectJutsu(sim, botId, intent.select);
  if (intent.sign) {
    const { event } = observeSign(sim, botId, intent.sign, nowMs);
    if (event) events.push(event);
  }
  return events;
}
