// The authoritative duel simulation as pure functions over plain objects. The server owns one
// DuelSim per room, feeds it validated requests between ticks, calls stepDuel once per fixed
// step, and mirrors the result into the synced Colyseus state. Nothing here touches the network,
// timers or randomness, so every rule has a unit test (simulation.test.ts).
import { DT, DT_MS, DUEL_CONFIG as C, JUTSUS, msToTicks } from './config.ts';
import { clamp, distance, exitFraction, normalise, sweptCircleHit, type Vec2 } from './math.ts';
import { clampToArena, commandDirection, stepWalk } from './movement.ts';
import {
  type DuelSign,
  type JutsuId,
  type MatchPhase,
  type PlayerSlot,
  type ResultReason,
} from './types.ts';

/** A tick far enough in the past that every "since" test treats it as never. */
export const NEVER = -1_000_000;

export interface PlayerStats {
  damageDealt: number;
  damageTaken: number;
  casts: Record<JutsuId, number>;
  dodgesUsed: number;
  dodgesSuccessful: number;
  shieldAbsorbed: number;
}

export interface PlayerSim {
  id: string;
  nickname: string;
  slot: PlayerSlot;
  connected: boolean;
  ready: boolean;
  rematchVote: boolean;
  /** How many times this player has dropped during the current match (second drop forfeits). */
  disconnects: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  hp: number;
  chakra: number;
  stamina: number;
  shieldHp: number;
  shieldExpiresTick: number;
  dodgeStartsTick: number;
  dodgeEndsTick: number;
  dodgeReadyTick: number;
  dodgeDirX: number;
  dodgeDirY: number;
  dodgeRemaining: number;
  selectedJutsuId: JutsuId;
  signIndex: number;
  /** Server-only: when the last accepted sign arrived, for the gap rules. */
  signLastAtMs: number;
  castJutsuId: JutsuId | '';
  castEndsTick: number;
  cooldownReadyTick: Record<JutsuId, number>;
  lastHpDamageTick: number;
  alive: boolean;
  moveX: number;
  moveY: number;
  stats: PlayerStats;
}

export interface ProjectileSim {
  id: number;
  ownerId: string;
  jutsuId: JutsuId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  expiresTick: number;
}

/** Durations a room may shorten in a clearly labelled test environment (never in production). */
export interface DuelTimings {
  countdownMs: number;
  resumeCountdownMs: number;
  durationMs: number;
}

export interface DuelSim {
  timings: DuelTimings;
  phase: MatchPhase;
  tick: number;
  countdownTicksRemaining: number;
  /** True while the countdown is the 2 s resumption after a reconnect, for UI copy. */
  resuming: boolean;
  activeTicksRemaining: number;
  winnerId: string;
  resultReason: ResultReason;
  players: PlayerSim[];
  projectiles: ProjectileSim[];
  nextProjectileId: number;
}

export type DuelEvent =
  | { type: 'MATCH_STARTED'; tick: number }
  | { type: 'DODGE_STARTED'; tick: number; actorId: string; dirX: number; dirY: number }
  | { type: 'CAST_STARTED'; tick: number; actorId: string; jutsuId: JutsuId; castEndsTick: number }
  | { type: 'CAST_RELEASED'; tick: number; actorId: string; jutsuId: JutsuId; projectileId: number }
  | { type: 'SHIELD_ON'; tick: number; actorId: string; absorb: number }
  | { type: 'SHIELD_OFF'; tick: number; actorId: string; reason: 'broken' | 'expired' }
  | {
      type: 'HIT';
      tick: number;
      projectileId: number;
      actorId: string;
      targetId: string;
      jutsuId: JutsuId;
      damage: number;
      shieldAbsorbed: number;
      dodged: boolean;
      x: number;
      y: number;
    }
  | { type: 'PROJECTILE_EXPIRED'; tick: number; projectileId: number }
  | { type: 'KO'; tick: number; targetId: string }
  | { type: 'MATCH_ENDED'; tick: number; winnerId: string; reason: ResultReason };

export type RejectReason =
  | 'not_playing'
  | 'dead'
  | 'already_dodging'
  | 'casting'
  | 'insufficient_stamina'
  | 'dodge_cooldown'
  | 'unknown_jutsu'
  | 'sequence_in_progress'
  | 'wrong_sign'
  | 'sign_too_fast'
  | 'sign_timeout'
  | 'insufficient_chakra'
  | 'jutsu_cooldown'
  | 'unknown_player';

export type ActionResult = { ok: true } | { ok: false; reason: RejectReason };

export type SignResult =
  | { ok: true; index: number; required: number; cast: ActionResult | null }
  | { ok: false; reason: RejectReason; index: number; required: number };

const JUTSU_IDS: readonly JutsuId[] = ['fireball', 'lightning_spear', 'water_shield'];

function emptyStats(): PlayerStats {
  return {
    damageDealt: 0,
    damageTaken: 0,
    casts: { fireball: 0, lightning_spear: 0, water_shield: 0 },
    dodgesUsed: 0,
    dodgesSuccessful: 0,
    shieldAbsorbed: 0,
  };
}

export function createPlayerSim(id: string, nickname: string, slot: PlayerSlot): PlayerSim {
  const spawn = C.player.spawns[slot - 1] ?? { x: 0, y: 0 };
  return {
    id,
    nickname,
    slot,
    connected: true,
    ready: false,
    rematchVote: false,
    disconnects: 0,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    facing: slot === 1 ? 0 : Math.PI,
    hp: C.resources.maxHp,
    chakra: C.resources.maxChakra,
    stamina: C.resources.maxStamina,
    shieldHp: 0,
    shieldExpiresTick: NEVER,
    dodgeStartsTick: NEVER,
    dodgeEndsTick: NEVER,
    dodgeReadyTick: NEVER,
    dodgeDirX: 0,
    dodgeDirY: 0,
    dodgeRemaining: 0,
    selectedJutsuId: 'fireball',
    signIndex: 0,
    signLastAtMs: NEVER,
    castJutsuId: '',
    castEndsTick: NEVER,
    cooldownReadyTick: { fireball: NEVER, lightning_spear: NEVER, water_shield: NEVER },
    lastHpDamageTick: NEVER,
    alive: true,
    moveX: 0,
    moveY: 0,
    stats: emptyStats(),
  };
}

export function createDuelSim(timings: Partial<DuelTimings> = {}): DuelSim {
  const resolved: DuelTimings = {
    countdownMs: C.match.countdownMs,
    resumeCountdownMs: C.match.resumeCountdownMs,
    durationMs: C.match.durationMs,
    ...timings,
  };
  return {
    timings: resolved,
    phase: 'WAITING',
    tick: 0,
    countdownTicksRemaining: 0,
    resuming: false,
    activeTicksRemaining: msToTicks(resolved.durationMs),
    winnerId: '',
    resultReason: '',
    players: [],
    projectiles: [],
    nextProjectileId: 1,
  };
}

export function getPlayer(sim: DuelSim, id: string): PlayerSim | undefined {
  return sim.players.find((p) => p.id === id);
}

export function getOpponent(sim: DuelSim, id: string): PlayerSim | undefined {
  return sim.players.find((p) => p.id !== id);
}

/** Seats the player in the lowest free slot; null when both seats are taken. */
export function addPlayer(sim: DuelSim, id: string, nickname: string): PlayerSim | null {
  if (sim.players.length >= C.match.maxPlayers || getPlayer(sim, id)) return null;
  const slot: PlayerSlot = sim.players.some((p) => p.slot === 1) ? 2 : 1;
  const player = createPlayerSim(id, nickname, slot);
  sim.players.push(player);
  sim.players.sort((a, b) => a.slot - b.slot);
  return player;
}

export function removePlayer(sim: DuelSim, id: string): void {
  sim.players = sim.players.filter((p) => p.id !== id);
  for (const p of sim.players) p.ready = false;
  if (sim.phase === 'READY') sim.phase = 'WAITING';
}

/** Both seats filled, both ready, both connected: the lobby condition for the countdown. */
export function canStart(sim: DuelSim): boolean {
  return (
    sim.players.length === C.match.maxPlayers &&
    sim.players.every((p) => p.ready && p.connected) &&
    (sim.phase === 'WAITING' || sim.phase === 'READY')
  );
}

export function setReady(sim: DuelSim, id: string, ready: boolean): boolean {
  const player = getPlayer(sim, id);
  if (!player || (sim.phase !== 'WAITING' && sim.phase !== 'READY')) return false;
  player.ready = ready;
  sim.phase =
    sim.players.length === C.match.maxPlayers && sim.players.every((p) => p.ready)
      ? 'READY'
      : 'WAITING';
  return true;
}

/** Starts the shared countdown; `resuming` uses the shorter post-reconnect countdown. */
export function beginCountdown(sim: DuelSim, resuming = false): void {
  sim.phase = 'COUNTDOWN';
  sim.resuming = resuming;
  sim.countdownTicksRemaining = msToTicks(
    resuming ? sim.timings.resumeCountdownMs : sim.timings.countdownMs,
  );
}

export function pauseForReconnect(sim: DuelSim): void {
  if (sim.phase === 'PLAYING' || sim.phase === 'COUNTDOWN') sim.phase = 'PAUSED_RECONNECT';
}

/** Resets everything but seats and nicknames, then runs the countdown again. */
export function resetForRematch(sim: DuelSim): void {
  const seats = sim.players.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    slot: p.slot,
    connected: p.connected,
  }));
  sim.players = seats.map((s) => {
    const player = createPlayerSim(s.id, s.nickname, s.slot);
    player.connected = s.connected;
    player.ready = true;
    return player;
  });
  sim.projectiles = [];
  sim.nextProjectileId = 1;
  sim.tick = 0;
  sim.activeTicksRemaining = msToTicks(sim.timings.durationMs);
  sim.winnerId = '';
  sim.resultReason = '';
  sim.resuming = false;
  beginCountdown(sim);
}

export function finishMatch(
  sim: DuelSim,
  winnerId: string,
  reason: ResultReason,
): DuelEvent | null {
  if (sim.phase === 'FINISHED') return null;
  sim.phase = 'FINISHED';
  sim.winnerId = winnerId;
  sim.resultReason = reason;
  for (const p of sim.players) {
    p.castJutsuId = '';
    p.signIndex = 0;
    p.moveX = 0;
    p.moveY = 0;
  }
  return { type: 'MATCH_ENDED', tick: sim.tick, winnerId, reason };
}

export function isDodging(player: PlayerSim, tick: number): boolean {
  return tick < player.dodgeEndsTick;
}

export function isCasting(player: PlayerSim, tick: number): boolean {
  return player.castJutsuId !== '' && tick < player.castEndsTick;
}

/** I-frames cover 30 to 150 ms after the dodge started, evaluated at tick resolution. */
export function isInvulnerable(player: PlayerSim, tick: number): boolean {
  if (player.dodgeStartsTick === NEVER) return false;
  const sinceMs = (tick - player.dodgeStartsTick) * DT_MS;
  return sinceMs >= C.dodge.invulnStartMs && sinceMs <= C.dodge.invulnEndMs;
}

export function setMoveInput(sim: DuelSim, id: string, moveX: number, moveY: number): void {
  const player = getPlayer(sim, id);
  if (!player) return;
  const direction = commandDirection({ moveX, moveY });
  player.moveX = direction.x;
  player.moveY = direction.y;
}

export function requestDodge(
  sim: DuelSim,
  id: string,
): { result: ActionResult; event: DuelEvent | null } {
  const player = getPlayer(sim, id);
  if (!player) return { result: { ok: false, reason: 'unknown_player' }, event: null };
  const tick = sim.tick;
  const reason: RejectReason | null =
    sim.phase !== 'PLAYING'
      ? 'not_playing'
      : !player.alive
        ? 'dead'
        : isDodging(player, tick)
          ? 'already_dodging'
          : isCasting(player, tick)
            ? 'casting'
            : player.stamina < C.dodge.staminaCost
              ? 'insufficient_stamina'
              : tick < player.dodgeReadyTick
                ? 'dodge_cooldown'
                : null;
  if (reason) return { result: { ok: false, reason }, event: null };

  let direction = normalise(player.moveX, player.moveY);
  if (direction.x === 0 && direction.y === 0) {
    const opponent = getOpponent(sim, id);
    direction = opponent ? normalise(player.x - opponent.x, player.y - opponent.y) : { x: 0, y: 0 };
    if (direction.x === 0 && direction.y === 0) direction = { x: player.slot === 1 ? -1 : 1, y: 0 };
  }
  player.stamina -= C.dodge.staminaCost;
  player.dodgeStartsTick = tick;
  player.dodgeEndsTick = tick + msToTicks(C.dodge.durationMs);
  player.dodgeReadyTick = tick + msToTicks(C.dodge.cooldownMs);
  player.dodgeDirX = direction.x;
  player.dodgeDirY = direction.y;
  player.dodgeRemaining = C.dodge.distance;
  player.facing = Math.atan2(direction.y, direction.x);
  player.stats.dodgesUsed += 1;
  return {
    result: { ok: true },
    event: { type: 'DODGE_STARTED', tick, actorId: id, dirX: direction.x, dirY: direction.y },
  };
}

export function selectJutsu(sim: DuelSim, id: string, jutsuId: JutsuId): ActionResult {
  const player = getPlayer(sim, id);
  if (!player) return { ok: false, reason: 'unknown_player' };
  if (!JUTSU_IDS.includes(jutsuId)) return { ok: false, reason: 'unknown_jutsu' };
  if (player.signIndex > 0) return { ok: false, reason: 'sequence_in_progress' };
  player.selectedJutsuId = jutsuId;
  return { ok: true };
}

export function cancelSigns(sim: DuelSim, id: string): void {
  const player = getPlayer(sim, id);
  if (player) player.signIndex = 0;
}

/** Validates a cast attempt and starts the wind-up. Chakra and cooldown are only spent on success. */
export function tryCast(
  sim: DuelSim,
  player: PlayerSim,
  jutsuId: JutsuId,
): { result: ActionResult; event: DuelEvent | null } {
  const tick = sim.tick;
  const jutsu = JUTSUS[jutsuId];
  const reason: RejectReason | null =
    sim.phase !== 'PLAYING'
      ? 'not_playing'
      : !player.alive
        ? 'dead'
        : isDodging(player, tick)
          ? 'already_dodging'
          : isCasting(player, tick)
            ? 'casting'
            : player.chakra < jutsu.chakra
              ? 'insufficient_chakra'
              : tick < player.cooldownReadyTick[jutsuId]
                ? 'jutsu_cooldown'
                : null;
  if (reason) return { result: { ok: false, reason }, event: null };
  player.chakra -= jutsu.chakra;
  player.cooldownReadyTick[jutsuId] = tick + msToTicks(jutsu.cooldownMs);
  player.castJutsuId = jutsuId;
  player.castEndsTick = tick + msToTicks(jutsu.castMs);
  player.stats.casts[jutsuId] += 1;
  return {
    result: { ok: true },
    event: {
      type: 'CAST_STARTED',
      tick,
      actorId: player.id,
      jutsuId,
      castEndsTick: player.castEndsTick,
    },
  };
}

/**
 * One debounced sign observation. Advances the ordered sequence of the selected jutsu, resets
 * it on a wrong sign or a gap over 3 s, refuses signs faster than 120 ms apart, and attempts the
 * cast when the last sign lands. `nowMs` is the server clock at receipt.
 */
export function observeSign(
  sim: DuelSim,
  id: string,
  sign: DuelSign,
  nowMs: number,
): { result: SignResult; event: DuelEvent | null } {
  const player = getPlayer(sim, id);
  if (!player)
    return { result: { ok: false, reason: 'unknown_player', index: 0, required: 0 }, event: null };
  const jutsu = JUTSUS[player.selectedJutsuId];
  const required = jutsu.signs.length;
  const fail = (reason: RejectReason): { result: SignResult; event: null } => ({
    result: { ok: false, reason, index: player.signIndex, required },
    event: null,
  });
  if (sim.phase !== 'PLAYING') return fail('not_playing');
  if (!player.alive) return fail('dead');

  const sinceLast = nowMs - player.signLastAtMs;
  if (player.signLastAtMs !== NEVER && sinceLast < C.signs.minGapMs) return fail('sign_too_fast');
  if (player.signIndex > 0 && sinceLast > C.signs.maxGapMs) {
    player.signIndex = 0;
    player.signLastAtMs = nowMs;
    return fail('sign_timeout');
  }
  player.signLastAtMs = nowMs;
  if (jutsu.signs[player.signIndex] !== sign) {
    player.signIndex = 0;
    return fail('wrong_sign');
  }
  player.signIndex += 1;
  if (player.signIndex < required) {
    return { result: { ok: true, index: player.signIndex, required, cast: null }, event: null };
  }
  player.signIndex = 0;
  const cast = tryCast(sim, player, jutsu.id);
  return { result: { ok: true, index: required, required, cast: cast.result }, event: cast.event };
}

/** Forfeit by the given player: the opponent wins, or nobody when both are gone. */
export function forfeit(
  sim: DuelSim,
  loserId: string,
  reason: ResultReason = 'forfeit',
): DuelEvent | null {
  const opponent = getOpponent(sim, loserId);
  return finishMatch(sim, opponent?.id ?? '', reason);
}

/** One fixed step in the order the spec prescribes. Returns the events this tick produced. */
export function stepDuel(sim: DuelSim): DuelEvent[] {
  const events: DuelEvent[] = [];

  if (sim.phase === 'COUNTDOWN') {
    sim.countdownTicksRemaining -= 1;
    if (sim.countdownTicksRemaining <= 0) {
      sim.countdownTicksRemaining = 0;
      const wasResuming = sim.resuming;
      sim.resuming = false;
      sim.phase = 'PLAYING';
      if (!wasResuming) events.push({ type: 'MATCH_STARTED', tick: sim.tick });
    }
    return events;
  }
  if (sim.phase !== 'PLAYING') return events;

  const tick = sim.tick;
  advanceTimelinesAndMove(sim, tick);
  releaseCasts(sim, tick, events);
  expireShields(sim, tick, events);
  moveProjectiles(sim, tick, events);
  expireProjectiles(sim, tick, events);
  regenerate(sim, tick);
  evaluateOutcome(sim, tick, events);
  sim.activeTicksRemaining = Math.max(0, sim.activeTicksRemaining - 1);
  sim.tick += 1;
  return events;
}

function advanceTimelinesAndMove(sim: DuelSim, tick: number): void {
  // Slot order is the deterministic order for overlap resolution.
  for (const player of sim.players) {
    const before = { x: player.x, y: player.y };
    if (!player.alive) {
      player.vx = 0;
      player.vy = 0;
      continue;
    }
    let next: Vec2;
    if (isDodging(player, tick)) {
      const dashSpeed = C.dodge.distance / (C.dodge.durationMs / 1000);
      const step = Math.min(dashSpeed * DT, player.dodgeRemaining);
      player.dodgeRemaining -= step;
      next = clampToArena({
        x: player.x + player.dodgeDirX * step,
        y: player.y + player.dodgeDirY * step,
      });
    } else {
      const multiplier = isCasting(player, tick) ? C.player.castMoveMultiplier : 1;
      next = stepWalk(before, { moveX: player.moveX, moveY: player.moveY }, DT, {
        speedMultiplier: multiplier,
      });
      if (player.moveX !== 0 || player.moveY !== 0)
        player.facing = Math.atan2(player.moveY, player.moveX);
    }
    const opponent = getOpponent(sim, player.id);
    if (opponent) next = separateFrom(next, opponent, player.slot);
    player.vx = (next.x - before.x) / DT;
    player.vy = (next.y - before.y) / DT;
    player.x = next.x;
    player.y = next.y;
  }
}

/** Stops the mover at the valid position against the opponent's body, then re-clamps to the arena. */
function separateFrom(position: Vec2, other: Vec2, slot: PlayerSlot): Vec2 {
  const minDistance = C.player.radius * 2;
  const gap = distance(position, other);
  if (gap >= minDistance) return position;
  let axis = normalise(position.x - other.x, position.y - other.y);
  if (axis.x === 0 && axis.y === 0) axis = { x: slot === 1 ? -1 : 1, y: 0 };
  return clampToArena({ x: other.x + axis.x * minDistance, y: other.y + axis.y * minDistance });
}

function releaseCasts(sim: DuelSim, tick: number, events: DuelEvent[]): void {
  for (const player of sim.players) {
    if (player.castJutsuId === '' || tick < player.castEndsTick) continue;
    const jutsuId = player.castJutsuId;
    player.castJutsuId = '';
    if (!player.alive) continue;
    const jutsu = JUTSUS[jutsuId];
    if (jutsu.kind === 'shield') {
      player.shieldHp = jutsu.absorb;
      player.shieldExpiresTick = tick + msToTicks(jutsu.durationMs);
      events.push({ type: 'SHIELD_ON', tick, actorId: player.id, absorb: jutsu.absorb });
      continue;
    }
    const opponent = getOpponent(sim, player.id);
    let aim = opponent ? normalise(opponent.x - player.x, opponent.y - player.y) : { x: 0, y: 0 };
    if (aim.x === 0 && aim.y === 0)
      aim = { x: Math.cos(player.facing), y: Math.sin(player.facing) };
    player.facing = Math.atan2(aim.y, aim.x);
    const projectile: ProjectileSim = {
      id: sim.nextProjectileId,
      ownerId: player.id,
      jutsuId,
      x: player.x + aim.x * C.cast.projectileSpawnOffset,
      y: player.y + aim.y * C.cast.projectileSpawnOffset,
      vx: aim.x * jutsu.speed,
      vy: aim.y * jutsu.speed,
      radius: jutsu.radius,
      damage: jutsu.damage,
      expiresTick: tick + msToTicks(jutsu.lifetimeMs),
    };
    sim.nextProjectileId += 1;
    sim.projectiles.push(projectile);
    events.push({
      type: 'CAST_RELEASED',
      tick,
      actorId: player.id,
      jutsuId,
      projectileId: projectile.id,
    });
  }
}

function expireShields(sim: DuelSim, tick: number, events: DuelEvent[]): void {
  for (const player of sim.players) {
    if (player.shieldHp > 0 && tick >= player.shieldExpiresTick) {
      player.shieldHp = 0;
      player.shieldExpiresTick = NEVER;
      events.push({ type: 'SHIELD_OFF', tick, actorId: player.id, reason: 'expired' });
    }
  }
}

function moveProjectiles(sim: DuelSim, tick: number, events: DuelEvent[]): void {
  const remaining: ProjectileSim[] = [];
  for (const projectile of sim.projectiles) {
    const from = { x: projectile.x, y: projectile.y };
    const to = { x: from.x + projectile.vx * DT, y: from.y + projectile.vy * DT };
    const target = sim.players.find((p) => p.id !== projectile.ownerId && p.alive);
    const hitAt = target
      ? sweptCircleHit(from, to, target, C.player.radius + projectile.radius)
      : null;
    const wallAt = exitFraction(from, to, C.arena.width, C.arena.height);

    if (hitAt !== null && target && (wallAt === null || hitAt <= wallAt)) {
      const point = { x: from.x + (to.x - from.x) * hitAt, y: from.y + (to.y - from.y) * hitAt };
      events.push(applyHit(sim, projectile, target, tick, point));
      continue;
    }
    if (wallAt !== null) {
      events.push({ type: 'PROJECTILE_EXPIRED', tick, projectileId: projectile.id });
      continue;
    }
    projectile.x = to.x;
    projectile.y = to.y;
    remaining.push(projectile);
  }
  sim.projectiles = remaining;
}

function applyHit(
  sim: DuelSim,
  projectile: ProjectileSim,
  target: PlayerSim,
  tick: number,
  point: Vec2,
): DuelEvent {
  const owner = getPlayer(sim, projectile.ownerId);
  const base = {
    type: 'HIT' as const,
    tick,
    projectileId: projectile.id,
    actorId: projectile.ownerId,
    targetId: target.id,
    jutsuId: projectile.jutsuId,
    x: point.x,
    y: point.y,
  };
  if (isInvulnerable(target, tick)) {
    target.stats.dodgesSuccessful += 1;
    return { ...base, damage: 0, shieldAbsorbed: 0, dodged: true };
  }
  const absorbed = Math.min(target.shieldHp, projectile.damage);
  const hpDamage = projectile.damage - absorbed;
  if (absorbed > 0) {
    target.shieldHp -= absorbed;
    target.stats.shieldAbsorbed += absorbed;
    if (target.shieldHp <= 0) {
      target.shieldHp = 0;
      target.shieldExpiresTick = NEVER;
    }
  }
  if (hpDamage > 0) {
    target.hp = Math.max(0, target.hp - hpDamage);
    target.lastHpDamageTick = tick;
    target.stats.damageTaken += hpDamage;
    if (owner) owner.stats.damageDealt += hpDamage;
    if (target.hp <= 0) target.alive = false;
  }
  return { ...base, damage: hpDamage, shieldAbsorbed: absorbed, dodged: false };
}

function expireProjectiles(sim: DuelSim, tick: number, events: DuelEvent[]): void {
  sim.projectiles = sim.projectiles.filter((projectile) => {
    if (tick + 1 < projectile.expiresTick) return true;
    events.push({ type: 'PROJECTILE_EXPIRED', tick, projectileId: projectile.id });
    return false;
  });
}

function regenerate(sim: DuelSim, tick: number): void {
  const r = C.resources;
  for (const player of sim.players) {
    if (!player.alive) continue;
    player.chakra = clamp(player.chakra + r.chakraRegenPerSec * DT, 0, r.maxChakra);
    if (!isDodging(player, tick)) {
      player.stamina = clamp(player.stamina + r.staminaRegenPerSec * DT, 0, r.maxStamina);
    }
    if ((tick - player.lastHpDamageTick) * DT_MS >= r.hpRegenDelayMs) {
      player.hp = clamp(player.hp + r.hpRegenPerSec * DT, 0, r.maxHp);
    }
  }
}

function evaluateOutcome(sim: DuelSim, tick: number, events: DuelEvent[]): void {
  const dead = sim.players.filter((p) => !p.alive);
  for (const p of dead) events.push({ type: 'KO', tick, targetId: p.id });
  if (dead.length === sim.players.length && dead.length > 0) {
    push(events, finishMatch(sim, '', 'draw'));
    return;
  }
  if (dead.length === 1) {
    const winner = sim.players.find((p) => p.alive);
    push(events, finishMatch(sim, winner?.id ?? '', 'ko'));
    return;
  }
  if (sim.activeTicksRemaining <= 1) {
    const [a, b] = sim.players;
    if (!a || !b) return;
    if (a.hp === b.hp) push(events, finishMatch(sim, '', 'draw'));
    else push(events, finishMatch(sim, a.hp > b.hp ? a.id : b.id, 'timeout'));
  }
}

function push(events: DuelEvent[], event: DuelEvent | null): void {
  if (event) events.push(event);
}
