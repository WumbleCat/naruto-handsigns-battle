// Turns the authoritative state, the local input history and recent events into one frame
// to draw. Local player: server position plus unacknowledged inputs, eased. Remote player:
// interpolated 100 ms behind the newest patch. Projectiles: extrapolated along their
// velocity since the patch that last moved them. Effects: short-lived, keyed by event id.
import {
  DT_MS,
  DUEL_CONFIG,
  JUTSUS,
  type DuelNetState,
  type GameEventMessage,
  type JutsuId,
  type PlayerNetState,
} from '@jutsu-duel/duel-shared';
import { correctTowards, InputHistory, replayUnacked, SnapshotBuffer } from '../net/prediction';

export const INTERPOLATION_DELAY_MS = 100;
const SNAP_DISTANCE = 80;
const EASING = 0.35;
const EFFECT_MS: Record<EffectKind, number> = {
  damage: 900,
  dodge: 500,
  hit: 400,
  shield: 600,
  cast: 350,
  ko: 1200,
};

export type EffectKind = 'damage' | 'dodge' | 'hit' | 'shield' | 'cast' | 'ko';

export interface EffectView {
  id: number;
  kind: EffectKind;
  x: number;
  y: number;
  text: string;
  /** 0 at creation, 1 at expiry. */
  age: number;
  jutsuId?: JutsuId;
}

export interface PlayerView {
  id: string;
  nickname: string;
  slot: number;
  isLocal: boolean;
  x: number;
  y: number;
  facing: number;
  hp: number;
  shieldHp: number;
  alive: boolean;
  connected: boolean;
  dodging: boolean;
  invulnerable: boolean;
  castJutsuId: JutsuId | null;
  castFraction: number;
  trail: Array<{ x: number; y: number; age: number }>;
}

export interface ProjectileView {
  id: number;
  jutsuId: JutsuId;
  x: number;
  y: number;
  radius: number;
  angle: number;
}

export interface FrameModel {
  phase: DuelNetState['phase'];
  players: PlayerView[];
  projectiles: ProjectileView[];
  effects: EffectView[];
}

interface ProjectileTrack {
  x: number;
  y: number;
  vx: number;
  vy: number;
  seenAt: number;
}

interface Effect extends Omit<EffectView, 'age'> {
  bornAt: number;
  ttl: number;
}

export interface LocalInputAck {
  lastProcessed: () => number;
}

export class DuelPresenter {
  readonly history = new InputHistory(64);
  private readonly remote = new Map<string, SnapshotBuffer>();
  private readonly projectiles = new Map<number, ProjectileTrack>();
  private readonly trails = new Map<string, Array<{ x: number; y: number; at: number }>>();
  private readonly effects: Effect[] = [];
  private readonly seenEvents = new Set<number>();
  private displayed: { x: number; y: number } | null = null;
  private localId = '';
  private ack: LocalInputAck = { lastProcessed: () => Number.MAX_SAFE_INTEGER };

  setLocal(sessionId: string, ack: LocalInputAck): void {
    if (sessionId !== this.localId) {
      this.localId = sessionId;
      this.displayed = null;
      this.history.clear();
    }
    this.ack = ack;
  }

  /** Called on every state patch. */
  onPatch(state: DuelNetState, now: number): void {
    for (const player of state.players.values()) {
      if (player.id === this.localId) continue;
      let buffer = this.remote.get(player.id);
      if (!buffer) {
        buffer = new SnapshotBuffer();
        this.remote.set(player.id, buffer);
      }
      buffer.push(now, { x: player.x, y: player.y });
    }
    for (const key of [...this.remote.keys()]) {
      if (!state.players.has(key)) this.remote.delete(key);
    }
    const live = new Set<number>();
    for (const projectile of state.projectiles.values()) {
      live.add(projectile.id);
      const track = this.projectiles.get(projectile.id);
      if (!track || track.x !== projectile.x || track.y !== projectile.y) {
        this.projectiles.set(projectile.id, {
          x: projectile.x,
          y: projectile.y,
          vx: projectile.vx,
          vy: projectile.vy,
          seenAt: now,
        });
      }
    }
    for (const id of [...this.projectiles.keys()]) {
      if (!live.has(id)) this.projectiles.delete(id);
    }
  }

  /** Called for every GAME_EVENT; repeats of an event id are ignored. */
  onEvent(event: GameEventMessage, state: DuelNetState | null, now: number): void {
    if (this.seenEvents.has(event.eventId)) return;
    this.seenEvents.add(event.eventId);
    if (this.seenEvents.size > 512) {
      const oldest = this.seenEvents.values().next().value;
      if (oldest !== undefined) this.seenEvents.delete(oldest);
    }
    const data = event.data ?? {};
    const at = (id: string | undefined): { x: number; y: number } => {
      const player = id ? state?.players.get(id) : undefined;
      return player ? { x: player.x, y: player.y } : { x: 600, y: 350 };
    };
    switch (event.type) {
      case 'HIT': {
        const x = typeof data.x === 'number' ? data.x : at(event.targetId).x;
        const y = typeof data.y === 'number' ? data.y : at(event.targetId).y;
        const dodged = data.dodged === true;
        const damage = typeof data.damage === 'number' ? data.damage : 0;
        const absorbed = typeof data.shieldAbsorbed === 'number' ? data.shieldAbsorbed : 0;
        const text = dodged ? 'Dodged' : damage > 0 ? `-${damage}` : absorbed > 0 ? 'Shielded' : '';
        this.addEffect(dodged ? 'dodge' : 'damage', x, y - 30, text, now, event.eventId);
        this.addEffect('hit', x, y, '', now, event.eventId + 0.5);
        break;
      }
      case 'DODGE_STARTED': {
        const p = at(event.actorId);
        this.addEffect('dodge', p.x, p.y, '', now, event.eventId);
        break;
      }
      case 'CAST_RELEASED': {
        const p = at(event.actorId);
        const jutsuId = typeof data.jutsuId === 'string' ? (data.jutsuId as JutsuId) : undefined;
        this.addEffect('cast', p.x, p.y, '', now, event.eventId, jutsuId);
        break;
      }
      case 'SHIELD_ON':
      case 'SHIELD_OFF': {
        const p = at(event.actorId);
        this.addEffect(
          'shield',
          p.x,
          p.y - 40,
          event.type === 'SHIELD_ON' ? 'Shield up' : 'Shield down',
          now,
          event.eventId,
        );
        break;
      }
      case 'KO': {
        const p = at(event.targetId);
        this.addEffect('ko', p.x, p.y - 40, 'KO', now, event.eventId);
        break;
      }
      default:
        break;
    }
  }

  frame(state: DuelNetState, now: number): FrameModel {
    const players: PlayerView[] = [];
    for (const player of state.players.values()) {
      const isLocal = player.id === this.localId;
      const position = isLocal
        ? this.localPosition(player, state)
        : this.remotePosition(player, now);
      this.recordTrail(player.id, position, now, player.dodgeEndsTick > state.tick);
      const castJutsuId = player.castJutsuId ? (player.castJutsuId as JutsuId) : null;
      const castFraction = castJutsuId
        ? 1 -
          Math.max(0, player.castEndsTick - state.tick) /
            Math.max(1, ticksOf(JUTSUS[castJutsuId].castMs))
        : 0;
      const sinceDodgeMs = (state.tick - player.dodgeStartsTick) * DT_MS;
      players.push({
        id: player.id,
        nickname: player.nickname,
        slot: player.slot,
        isLocal,
        x: position.x,
        y: position.y,
        facing: player.facing,
        hp: player.hp,
        shieldHp: player.shieldHp,
        alive: player.alive,
        connected: player.connected,
        dodging: state.tick < player.dodgeEndsTick,
        invulnerable:
          player.dodgeStartsTick >= 0 &&
          sinceDodgeMs >= DUEL_CONFIG.dodge.invulnStartMs &&
          sinceDodgeMs <= DUEL_CONFIG.dodge.invulnEndMs,
        castJutsuId,
        castFraction,
        trail: (this.trails.get(player.id) ?? []).map((t) => ({
          x: t.x,
          y: t.y,
          age: Math.min(1, (now - t.at) / 400),
        })),
      });
    }

    const projectiles: ProjectileView[] = [];
    for (const projectile of state.projectiles.values()) {
      const track = this.projectiles.get(projectile.id);
      const elapsed = track ? Math.min(0.25, (now - track.seenAt) / 1000) : 0;
      const x = (track?.x ?? projectile.x) + projectile.vx * elapsed;
      const y = (track?.y ?? projectile.y) + projectile.vy * elapsed;
      projectiles.push({
        id: projectile.id,
        jutsuId: projectile.jutsuId as JutsuId,
        x,
        y,
        radius: projectile.radius,
        angle: Math.atan2(projectile.vy, projectile.vx),
      });
    }

    const effects: EffectView[] = [];
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const effect = this.effects[i];
      if (!effect) continue;
      const age = (now - effect.bornAt) / effect.ttl;
      if (age >= 1) {
        this.effects.splice(i, 1);
        continue;
      }
      effects.push({
        id: effect.id,
        kind: effect.kind,
        x: effect.x,
        y: effect.y,
        text: effect.text,
        age,
        jutsuId: effect.jutsuId,
      });
    }

    return { phase: state.phase, players, projectiles, effects };
  }

  private localPosition(player: PlayerNetState, state: DuelNetState): { x: number; y: number } {
    const server = { x: player.x, y: player.y };
    const dodging = state.tick < player.dodgeEndsTick;
    const casting = player.castJutsuId !== '' && state.tick < player.castEndsTick;
    const predicted =
      dodging || state.phase !== 'PLAYING' || !player.alive
        ? server
        : replayUnacked(
            server,
            this.history.after(this.ack.lastProcessed()),
            casting ? DUEL_CONFIG.player.castMoveMultiplier : 1,
          );
    this.displayed = this.displayed
      ? correctTowards(this.displayed, predicted, { snapDistance: SNAP_DISTANCE, easing: EASING })
      : predicted;
    return this.displayed;
  }

  private remotePosition(player: PlayerNetState, now: number): { x: number; y: number } {
    const buffer = this.remote.get(player.id);
    return buffer?.sample(now - INTERPOLATION_DELAY_MS) ?? { x: player.x, y: player.y };
  }

  private recordTrail(
    id: string,
    position: { x: number; y: number },
    now: number,
    dodging: boolean,
  ): void {
    let trail = this.trails.get(id);
    if (!trail) {
      trail = [];
      this.trails.set(id, trail);
    }
    if (dodging) {
      const last = trail[trail.length - 1];
      if (!last || now - last.at > 25) trail.push({ x: position.x, y: position.y, at: now });
    }
    while (trail.length > 0 && trail[0] !== undefined && now - trail[0].at > 400) trail.shift();
  }

  private addEffect(
    kind: EffectKind,
    x: number,
    y: number,
    text: string,
    now: number,
    id: number,
    jutsuId?: JutsuId,
  ): void {
    this.effects.push({ id, kind, x, y, text, bornAt: now, ttl: EFFECT_MS[kind], jutsuId });
  }
}

function ticksOf(ms: number): number {
  return Math.ceil(ms / DT_MS - 1e-9);
}
