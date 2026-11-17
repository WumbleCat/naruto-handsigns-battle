// The synced room state. Built with the @colyseus/schema builder (no decorators), mirrored from
// the pure DuelSim after every fixed step by `syncState`. Only what the client needs to render
// and to show the HUD is here; server-only facts (sign timestamps, reconnect tokens, hit
// dedupe) stay in the simulation and the room.
import { MapSchema, schema, t, type SchemaType } from '@colyseus/schema';
import type { DuelSim, PlayerSim, ProjectileSim } from '@jutsu-duel/duel-shared';

export const PlayerState = schema(
  {
    id: t.string().default(''),
    nickname: t.string().default(''),
    slot: t.uint8().default(1),
    connected: t.boolean().default(true),
    ready: t.boolean().default(false),
    rematchVote: t.boolean().default(false),
    x: t.float32().default(0),
    y: t.float32().default(0),
    vx: t.float32().default(0),
    vy: t.float32().default(0),
    facing: t.float32().default(0),
    hp: t.float32().default(100),
    chakra: t.float32().default(100),
    stamina: t.float32().default(100),
    shieldHp: t.float32().default(0),
    shieldExpiresTick: t.int32().default(-1),
    dodgeStartsTick: t.int32().default(-1),
    dodgeEndsTick: t.int32().default(-1),
    dodgeReadyTick: t.int32().default(-1),
    selectedJutsuId: t.string().default('fireball'),
    signIndex: t.uint8().default(0),
    castJutsuId: t.string().default(''),
    castEndsTick: t.int32().default(-1),
    fireballReadyTick: t.int32().default(-1),
    lightningReadyTick: t.int32().default(-1),
    shieldReadyTick: t.int32().default(-1),
    alive: t.boolean().default(true),
  },
  'DuelPlayer',
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const ProjectileState = schema(
  {
    id: t.uint32().default(0),
    ownerId: t.string().default(''),
    jutsuId: t.string().default(''),
    x: t.float32().default(0),
    y: t.float32().default(0),
    vx: t.float32().default(0),
    vy: t.float32().default(0),
    radius: t.float32().default(0),
    expiresTick: t.int32().default(0),
  },
  'DuelProjectile',
);
export type ProjectileState = SchemaType<typeof ProjectileState>;

export const DuelState = schema(
  {
    phase: t.string().default('WAITING'),
    tick: t.int32().default(0),
    tickRate: t.uint8().default(30),
    activeTicksRemaining: t.int32().default(0),
    countdownTicksRemaining: t.int32().default(0),
    resuming: t.boolean().default(false),
    winnerId: t.string().default(''),
    resultReason: t.string().default(''),
    players: t.map(PlayerState).default(() => new MapSchema<PlayerState>()),
    projectiles: t.map(ProjectileState).default(() => new MapSchema<ProjectileState>()),
  },
  'DuelState',
);
export type DuelState = SchemaType<typeof DuelState>;

/** Ticks far in the past are clamped to -1 on the wire; the client only tests "tick >= x". */
function wireTick(tick: number): number {
  return tick < -1 ? -1 : tick;
}

function syncPlayer(target: PlayerState, source: PlayerSim): void {
  target.id = source.id;
  target.nickname = source.nickname;
  target.slot = source.slot;
  target.connected = source.connected;
  target.ready = source.ready;
  target.rematchVote = source.rematchVote;
  target.x = source.x;
  target.y = source.y;
  target.vx = source.vx;
  target.vy = source.vy;
  target.facing = source.facing;
  target.hp = source.hp;
  target.chakra = source.chakra;
  target.stamina = source.stamina;
  target.shieldHp = source.shieldHp;
  target.shieldExpiresTick = wireTick(source.shieldExpiresTick);
  target.dodgeStartsTick = wireTick(source.dodgeStartsTick);
  target.dodgeEndsTick = wireTick(source.dodgeEndsTick);
  target.dodgeReadyTick = wireTick(source.dodgeReadyTick);
  target.selectedJutsuId = source.selectedJutsuId;
  target.signIndex = source.signIndex;
  target.castJutsuId = source.castJutsuId;
  target.castEndsTick = wireTick(source.castEndsTick);
  target.fireballReadyTick = wireTick(source.cooldownReadyTick.fireball);
  target.lightningReadyTick = wireTick(source.cooldownReadyTick.lightning_spear);
  target.shieldReadyTick = wireTick(source.cooldownReadyTick.water_shield);
  target.alive = source.alive;
}

function syncProjectile(target: ProjectileState, source: ProjectileSim): void {
  target.id = source.id;
  target.ownerId = source.ownerId;
  target.jutsuId = source.jutsuId;
  target.x = source.x;
  target.y = source.y;
  target.vx = source.vx;
  target.vy = source.vy;
  target.radius = source.radius;
  target.expiresTick = source.expiresTick;
}

/** Copies the simulation into the synced state. Unchanged fields produce no patch bytes. */
export function syncState(state: DuelState, sim: DuelSim): void {
  state.phase = sim.phase;
  state.tick = sim.tick;
  state.activeTicksRemaining = sim.activeTicksRemaining;
  state.countdownTicksRemaining = sim.countdownTicksRemaining;
  state.resuming = sim.resuming;
  state.winnerId = sim.winnerId;
  state.resultReason = sim.resultReason;

  const seenPlayers = new Set<string>();
  for (const player of sim.players) {
    seenPlayers.add(player.id);
    let target = state.players.get(player.id);
    if (!target) {
      target = new PlayerState();
      state.players.set(player.id, target);
    }
    syncPlayer(target, player);
  }
  for (const key of [...state.players.keys()]) {
    if (!seenPlayers.has(key)) state.players.delete(key);
  }

  const seenProjectiles = new Set<string>();
  for (const projectile of sim.projectiles) {
    const key = String(projectile.id);
    seenProjectiles.add(key);
    let target = state.projectiles.get(key);
    if (!target) {
      target = new ProjectileState();
      state.projectiles.set(key, target);
    }
    syncProjectile(target, projectile);
  }
  for (const key of [...state.projectiles.keys()]) {
    if (!seenProjectiles.has(key)) state.projectiles.delete(key);
  }
}
