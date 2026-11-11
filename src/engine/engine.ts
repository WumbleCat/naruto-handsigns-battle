// The battle engine (docs/DESIGN.md section 5 and 8.2). Pure TypeScript: no React, no DOM,
// no timers, no randomness. Time arrives as a parameter on every call; every state change
// emits a typed event. Deterministic: the same inputs in the same order give the same events.
import { advantage } from './elements';
import type {
  BattleState,
  EndReason,
  EngineEvent,
  MatchResult,
  PlayerState,
  PlayerStats,
  Projectile,
} from './events';
import { SequenceMatcher, validateRoster } from './sequence';
import {
  otherPlayer,
  type EngineBalance,
  type JutsuDef,
  type PlayerId,
  type SignId,
} from './types';

export interface BattleEngineOptions {
  balance: EngineBalance;
  roster: readonly JutsuDef[];
  /** Engine time at which the match starts (any monotonic ms clock). */
  startedAt: number;
}

export type EngineListener = (event: EngineEvent) => void;

interface MutablePlayer {
  hp: number;
  buffer: SignId[];
  bufferUpdatedAt: number | null;
  substitutionReadyAt: number;
  cooldownPending: boolean;
  stats: PlayerStats;
}

const PLAYERS: readonly PlayerId[] = ['p1', 'p2'];

function newPlayer(hp: number): MutablePlayer {
  return {
    hp,
    buffer: [],
    bufferUpdatedAt: null,
    substitutionReadyAt: 0,
    cooldownPending: false,
    stats: {
      damageDealt: 0,
      damageTaken: 0,
      jutsusCast: {},
      substitutions: 0,
      clashesWon: 0,
      clashesLost: 0,
    },
  };
}

export class BattleEngine {
  private readonly balance: EngineBalance;
  private readonly matcher: SequenceMatcher;
  private readonly listeners = new Set<EngineListener>();
  private readonly players: Record<PlayerId, MutablePlayer>;
  private readonly startedAt: number;
  private readonly endsAt: number;
  private inFlight: Projectile[] = [];
  private phase: 'active' | 'ended' = 'active';
  private result: MatchResult | null = null;
  private now: number;
  private nextProjectileId = 1;
  private version = 0;
  private snapshot: BattleState | null = null;
  private snapshotVersion = -1;

  constructor(options: BattleEngineOptions) {
    const problems = validateRoster(options.roster, options.balance);
    if (problems.length > 0) {
      throw new Error(`Invalid roster:\n${problems.join('\n')}`);
    }
    this.balance = options.balance;
    this.matcher = new SequenceMatcher(options.roster);
    this.players = { p1: newPlayer(options.balance.maxHp), p2: newPlayer(options.balance.maxHp) };
    this.startedAt = options.startedAt;
    this.now = options.startedAt;
    this.endsAt = options.startedAt + options.balance.roundDurationMs;
  }

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Immutable snapshot; the same object is returned until something changes. */
  getState(): BattleState {
    if (this.snapshotVersion !== this.version || !this.snapshot) {
      this.snapshot = this.buildSnapshot();
      this.snapshotVersion = this.version;
    }
    return this.snapshot;
  }

  /** Advance time: landings, buffer timeouts, cooldowns and the round timer. */
  tick(t: number): void {
    this.advanceTo(t);
  }

  /** A sign the stabiliser (or the opponent source) has registered for `player`. */
  registerSign(player: PlayerId, sign: SignId, t: number): void {
    this.advanceTo(t);
    if (this.phase !== 'active') return;
    const p = this.players[player];
    const now = this.now;

    if (this.balance.ignoreRepeatedSign && p.buffer[p.buffer.length - 1] === sign) return;

    const candidate = [...p.buffer, sign];
    const match = this.matcher.match(candidate);

    if (match.status === 'none') {
      if (p.buffer.length > 0) {
        this.emit({ type: 'bufferReset', t: now, player, reason: 'mismatch' });
      }
      p.buffer = this.matcher.isOpener(sign) ? [sign] : [];
      p.bufferUpdatedAt = p.buffer.length > 0 ? now : null;
      this.touch();
      this.emit({ type: 'signRegistered', t: now, player, sign, buffer: [...p.buffer] });
      return;
    }

    p.buffer = candidate;
    p.bufferUpdatedAt = now;
    this.touch();
    this.emit({ type: 'signRegistered', t: now, player, sign, buffer: [...p.buffer] });

    if (match.status === 'complete') this.cast(player, match.jutsu);
  }

  forfeit(player: PlayerId, t: number): void {
    this.advanceTo(t);
    if (this.phase !== 'active') return;
    this.endMatch(otherPlayer(player), 'forfeit');
  }

  // ---- time -------------------------------------------------------------------------------

  private advanceTo(target: number): void {
    const clamped = Math.max(target, this.now);
    while (this.phase === 'active') {
      const due = this.nextDueTime();
      if (due === null || due > clamped) break;
      this.now = due;
      this.processDue(due);
    }
    // The clock freezes at the end of the match so `now` reads as the match's final time.
    if (this.phase === 'active' && clamped > this.now) {
      this.now = clamped;
      this.touch();
    }
  }

  private nextDueTime(): number | null {
    let next: number | null = this.endsAt;
    const consider = (time: number | null) => {
      if (time !== null && (next === null || time < next)) next = time;
    };
    for (const projectile of this.inFlight) consider(projectile.landsAt);
    for (const id of PLAYERS) {
      const p = this.players[id];
      if (p.bufferUpdatedAt !== null) consider(p.bufferUpdatedAt + this.balance.bufferResetMs);
      if (p.cooldownPending) consider(p.substitutionReadyAt);
    }
    return next;
  }

  /** Everything due at `t`, in a fixed order: landings, buffer timeouts, cooldowns, round end. */
  private processDue(t: number): void {
    while (this.phase === 'active') {
      const landing = this.inFlight
        .filter((projectile) => projectile.landsAt <= t)
        .sort((a, b) => a.landsAt - b.landsAt || a.id - b.id)[0];
      if (!landing) break;
      this.inFlight = this.inFlight.filter((projectile) => projectile.id !== landing.id);
      this.applyHit(landing, 1, false);
      this.checkKo();
    }
    if (this.phase !== 'active') return;

    for (const id of PLAYERS) {
      const p = this.players[id];
      if (p.bufferUpdatedAt !== null && p.bufferUpdatedAt + this.balance.bufferResetMs <= t) {
        p.buffer = [];
        p.bufferUpdatedAt = null;
        this.touch();
        this.emit({ type: 'bufferReset', t, player: id, reason: 'timeout' });
      }
    }

    for (const id of PLAYERS) {
      const p = this.players[id];
      if (p.cooldownPending && p.substitutionReadyAt <= t) {
        p.cooldownPending = false;
        p.substitutionReadyAt = 0;
        this.touch();
        this.emit({ type: 'cooldownReady', t, player: id });
      }
    }

    if (this.endsAt <= t) {
      const { p1, p2 } = this.players;
      const winner = p1.hp === p2.hp ? null : p1.hp > p2.hp ? 'p1' : 'p2';
      this.endMatch(winner, 'timeout');
    }
  }

  // ---- combat -----------------------------------------------------------------------------

  private cast(player: PlayerId, jutsu: JutsuDef): void {
    const p = this.players[player];
    const now = this.now;
    p.buffer = [];
    p.bufferUpdatedAt = null;
    p.stats.jutsusCast[jutsu.id] = (p.stats.jutsusCast[jutsu.id] ?? 0) + 1;
    this.touch();
    this.emit({ type: 'bufferReset', t: now, player, reason: 'cast' });

    if (jutsu.kind === 'substitution') {
      this.substitute(player);
      return;
    }

    const baseDamage = this.balance.damageBySignCount[jutsu.sequence.length];
    if (baseDamage === undefined) {
      throw new Error(`No damage entry for ${jutsu.sequence.length} signs`);
    }
    const projectile: Projectile = {
      id: this.nextProjectileId,
      caster: player,
      jutsuId: jutsu.id,
      element: jutsu.element,
      baseDamage,
      castAt: now,
      landsAt: now + this.balance.flightMs,
    };
    this.nextProjectileId += 1;
    this.emit({
      type: 'jutsuCast',
      t: now,
      player,
      jutsuId: jutsu.id,
      element: jutsu.element,
      projectileId: projectile.id,
      landsAt: projectile.landsAt,
    });

    const incoming = this.oldestIncoming(player);
    if (incoming) {
      this.clash(incoming, projectile);
    } else {
      this.inFlight.push(projectile);
      this.touch();
    }
  }

  private oldestIncoming(player: PlayerId): Projectile | undefined {
    const opponent = otherPlayer(player);
    return this.inFlight
      .filter((projectile) => projectile.caster === opponent)
      .sort((a, b) => a.castAt - b.castAt || a.id - b.id)[0];
  }

  /** `existing` was in flight; `incoming` was just cast. Both resolve now. */
  private clash(existing: Projectile, incoming: Projectile): void {
    const now = this.now;
    const standing = advantage(this.balance.elementCycle, incoming.element, existing.element);
    const incomingMultiplier =
      standing === 'advantaged'
        ? this.balance.clashAdvantageMultiplier
        : standing === 'disadvantaged'
          ? this.balance.clashDisadvantageMultiplier
          : 1;
    const existingMultiplier =
      standing === 'advantaged'
        ? this.balance.clashDisadvantageMultiplier
        : standing === 'disadvantaged'
          ? this.balance.clashAdvantageMultiplier
          : 1;

    this.inFlight = this.inFlight.filter((projectile) => projectile.id !== existing.id);
    if (standing === 'advantaged') {
      this.players[incoming.caster].stats.clashesWon += 1;
      this.players[existing.caster].stats.clashesLost += 1;
    } else if (standing === 'disadvantaged') {
      this.players[existing.caster].stats.clashesWon += 1;
      this.players[incoming.caster].stats.clashesLost += 1;
    }
    this.touch();
    this.emit({
      type: 'clash',
      t: now,
      a: { projectileId: existing.id, caster: existing.caster, multiplier: existingMultiplier },
      b: { projectileId: incoming.id, caster: incoming.caster, multiplier: incomingMultiplier },
    });

    this.applyHit(existing, existingMultiplier, true);
    this.applyHit(incoming, incomingMultiplier, true);
    this.checkKo();
  }

  private applyHit(projectile: Projectile, multiplier: number, viaClash: boolean): void {
    const target = otherPlayer(projectile.caster);
    const damage = Math.round(projectile.baseDamage * multiplier);
    const victim = this.players[target];
    victim.hp = Math.max(0, victim.hp - damage);
    victim.stats.damageTaken += damage;
    this.players[projectile.caster].stats.damageDealt += damage;
    this.touch();
    this.emit({
      type: 'hit',
      t: this.now,
      target,
      projectileId: projectile.id,
      jutsuId: projectile.jutsuId,
      element: projectile.element,
      damage,
      hpAfter: victim.hp,
      viaClash,
    });
  }

  private substitute(player: PlayerId): void {
    const p = this.players[player];
    const now = this.now;

    if (p.cooldownPending && p.substitutionReadyAt > now) {
      this.emit({ type: 'substitutionFailed', t: now, player, reason: 'cooldown' });
      return;
    }

    const incoming = this.oldestIncoming(player);
    if (!incoming) {
      this.emit({ type: 'substitutionFailed', t: now, player, reason: 'nothingInFlight' });
      if (this.balance.substitutionWhiffTriggersCooldown) this.startCooldown(player);
      return;
    }

    this.inFlight = this.inFlight.filter((projectile) => projectile.id !== incoming.id);
    p.stats.substitutions += 1;
    this.touch();
    this.emit({ type: 'dodge', t: now, player, negatedProjectileId: incoming.id });
    this.startCooldown(player);
  }

  private startCooldown(player: PlayerId): void {
    const p = this.players[player];
    p.substitutionReadyAt = this.now + this.balance.substitutionCooldownMs;
    p.cooldownPending = true;
    this.touch();
  }

  private checkKo(): void {
    if (this.phase !== 'active') return;
    const p1Down = this.players.p1.hp <= 0;
    const p2Down = this.players.p2.hp <= 0;
    if (!p1Down && !p2Down) return;
    if (p1Down) this.emit({ type: 'ko', t: this.now, loser: 'p1' });
    if (p2Down) this.emit({ type: 'ko', t: this.now, loser: 'p2' });
    this.endMatch(p1Down && p2Down ? null : p1Down ? 'p2' : 'p1', 'ko');
  }

  private endMatch(winner: PlayerId | null, reason: EndReason): void {
    this.phase = 'ended';
    this.result = { winner, reason };
    this.touch();
    this.emit({ type: 'matchEnded', t: this.now, winner, reason });
  }

  // ---- plumbing ---------------------------------------------------------------------------

  private touch(): void {
    this.version += 1;
  }

  private emit(event: EngineEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private buildSnapshot(): BattleState {
    const snapshotPlayer = (p: MutablePlayer): PlayerState => ({
      hp: p.hp,
      buffer: [...p.buffer],
      bufferUpdatedAt: p.bufferUpdatedAt,
      substitutionReadyAt: p.cooldownPending ? p.substitutionReadyAt : 0,
      stats: { ...p.stats, jutsusCast: { ...p.stats.jutsusCast } },
    });
    return {
      phase: this.phase,
      startedAt: this.startedAt,
      endsAt: this.endsAt,
      now: this.now,
      players: { p1: snapshotPlayer(this.players.p1), p2: snapshotPlayer(this.players.p2) },
      inFlight: this.inFlight.map((projectile) => ({ ...projectile })),
      result: this.result ? { ...this.result } : null,
    };
  }
}
