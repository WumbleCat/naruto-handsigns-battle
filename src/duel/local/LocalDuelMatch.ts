// An offline duel against the bot, hosted in the browser. It does for one tab what the
// Colyseus room does for two: owns a DuelSim, feeds it validated requests, steps it at the
// shared tick rate and reports events, rejections and the result in the same message shapes.
// The pages and the renderer therefore cannot tell an offline match from an online one. Time
// is passed in, so the class runs unchanged under a test's fake clock.
import {
  addPlayer,
  applyBotIntent,
  beginCountdown,
  BOT_PARAMS,
  buildMatchResult,
  cancelSigns,
  createDuelSim,
  DT_MS,
  DUEL_CONFIG,
  DuelBot,
  getPlayer,
  JUTSUS,
  observeSign,
  requestDodge,
  resetForRematch,
  selectJutsu,
  setMoveInput,
  setReady,
  stepDuel,
  toGameEventMessage,
  type ActionRejectedMessage,
  type BotLevel,
  type DuelEvent,
  type DuelNetState,
  type DuelSign,
  type DuelSim,
  type DuelTimings,
  type GameEventMessage,
  type JutsuId,
  type MatchResultMessage,
  type PlayerNetState,
  type PlayerSim,
  type ProjectileNetState,
  type SignProgressMessage,
} from '@jutsu-duel/duel-shared';

export const LOCAL_PLAYER_ID = 'local-player';
export const LOCAL_BOT_ID = 'local-bot';

/** A tab that was in the background catches up by at most this many ticks, then carries on. */
const MAX_CATCH_UP_TICKS = 5;

export interface LocalMatchOptions {
  nickname: string;
  level: BotLevel;
  /** Seeds the bot's decisions; the same seed and inputs replay the same match. */
  seed: number;
  timings?: Partial<DuelTimings>;
}

export type LocalMatchMessage =
  | { type: 'event'; event: GameEventMessage }
  | { type: 'rejected'; rejection: ActionRejectedMessage }
  | { type: 'progress'; progress: SignProgressMessage }
  | { type: 'result'; result: MatchResultMessage | null };

/** Ticks far in the past read as -1, exactly as the server puts them on the wire. */
function wireTick(tick: number): number {
  return tick < -1 ? -1 : tick;
}

function playerView(source: PlayerSim): PlayerNetState {
  return {
    id: source.id,
    nickname: source.nickname,
    slot: source.slot,
    connected: source.connected,
    ready: source.ready,
    rematchVote: source.rematchVote,
    x: source.x,
    y: source.y,
    vx: source.vx,
    vy: source.vy,
    facing: source.facing,
    hp: source.hp,
    chakra: source.chakra,
    stamina: source.stamina,
    shieldHp: source.shieldHp,
    shieldExpiresTick: wireTick(source.shieldExpiresTick),
    dodgeStartsTick: wireTick(source.dodgeStartsTick),
    dodgeEndsTick: wireTick(source.dodgeEndsTick),
    dodgeReadyTick: wireTick(source.dodgeReadyTick),
    selectedJutsuId: source.selectedJutsuId,
    signIndex: source.signIndex,
    castJutsuId: source.castJutsuId,
    castEndsTick: wireTick(source.castEndsTick),
    fireballReadyTick: wireTick(source.cooldownReadyTick.fireball),
    lightningReadyTick: wireTick(source.cooldownReadyTick.lightning_spear),
    shieldReadyTick: wireTick(source.cooldownReadyTick.water_shield),
    alive: source.alive,
  };
}

/** The mutable state view the pages read; the same shape the Colyseus SDK decodes online. */
interface MutableNetState extends DuelNetState {
  players: Map<string, PlayerNetState>;
  projectiles: Map<string, ProjectileNetState>;
}

export class LocalDuelMatch {
  readonly level: BotLevel;
  readonly playerId = LOCAL_PLAYER_ID;
  readonly botId = LOCAL_BOT_ID;
  readonly state: MutableNetState;

  private readonly sim: DuelSim;
  private readonly bot: DuelBot;
  private readonly listeners = new Set<(message: LocalMatchMessage) => void>();
  private nextEventId = 1;
  private playedTicks = 0;
  private resultSent = false;
  private lastAdvanceAt: number | null = null;
  private owedMs = 0;
  private moveX = 0;
  private moveY = 0;

  constructor(options: LocalMatchOptions) {
    this.level = options.level;
    this.sim = createDuelSim(options.timings);
    this.bot = new DuelBot(LOCAL_BOT_ID, options.level, options.seed);
    addPlayer(this.sim, LOCAL_PLAYER_ID, options.nickname);
    addPlayer(this.sim, LOCAL_BOT_ID, BOT_PARAMS[options.level].name);
    setReady(this.sim, LOCAL_PLAYER_ID, true);
    setReady(this.sim, LOCAL_BOT_ID, true);
    beginCountdown(this.sim);
    this.state = {
      phase: this.sim.phase,
      tick: 0,
      tickRate: DUEL_CONFIG.tickRate,
      activeTicksRemaining: 0,
      countdownTicksRemaining: 0,
      resuming: false,
      winnerId: '',
      resultReason: '',
      players: new Map(),
      projectiles: new Map(),
    };
    this.mirror();
  }

  subscribe(listener: (message: LocalMatchMessage) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Steps as many ticks as wall time owes since the last call. Returns how many ran. */
  advance(nowMs: number): number {
    if (this.lastAdvanceAt === null) {
      this.lastAdvanceAt = nowMs;
      return 0;
    }
    this.owedMs += nowMs - this.lastAdvanceAt;
    this.lastAdvanceAt = nowMs;
    this.owedMs = Math.min(this.owedMs, MAX_CATCH_UP_TICKS * DT_MS);
    let ran = 0;
    while (this.owedMs >= DT_MS - 1e-6) {
      this.owedMs = Math.max(0, this.owedMs - DT_MS);
      this.step();
      ran += 1;
    }
    return ran;
  }

  /** One fixed tick: the player's held direction, the bot's decision, then the simulation. */
  step(): void {
    const sim = this.sim;
    const events: DuelEvent[] = [];
    if (sim.phase === 'PLAYING') {
      const matchMs = this.playedTicks * DT_MS;
      setMoveInput(sim, LOCAL_PLAYER_ID, this.moveX, this.moveY);
      events.push(...applyBotIntent(sim, LOCAL_BOT_ID, this.bot.think(sim, matchMs), matchMs));
      this.playedTicks += 1;
    }
    events.push(...stepDuel(sim));
    this.publish(events);
  }

  setMove(moveX: number, moveY: number): void {
    this.moveX = moveX;
    this.moveY = moveY;
  }

  requestDodge(): void {
    // The dash direction comes from the held keys, which the next tick would apply too late.
    setMoveInput(this.sim, LOCAL_PLAYER_ID, this.moveX, this.moveY);
    const { result, event } = requestDodge(this.sim, LOCAL_PLAYER_ID);
    if (!result.ok) this.reject({ action: 'dodge', reason: result.reason });
    this.publish(event ? [event] : []);
  }

  selectJutsu(jutsuId: JutsuId): void {
    const result = selectJutsu(this.sim, LOCAL_PLAYER_ID, jutsuId);
    if (!result.ok) this.reject({ action: 'select', reason: result.reason });
    this.publish([]);
    this.sendProgress();
  }

  /** `nowMs` is any monotonic clock; it only feeds the gap rules between this player's signs. */
  sendSign(sign: DuelSign, confidence: number, nowMs: number): void {
    if (confidence < DUEL_CONFIG.signs.minConfidence) {
      this.reject({ action: 'sign', reason: 'invalid' });
      return;
    }
    const { result, event } = observeSign(this.sim, LOCAL_PLAYER_ID, sign, nowMs);
    if (!result.ok) this.reject({ action: 'sign', reason: result.reason });
    else if (result.cast && !result.cast.ok)
      this.reject({ action: 'cast', reason: result.cast.reason });
    this.publish(event ? [event] : []);
    this.sendProgress();
  }

  cancelSigns(): void {
    cancelSigns(this.sim, LOCAL_PLAYER_ID);
    this.publish([]);
    this.sendProgress();
  }

  /** The bot always accepts, so a rematch starts at once. */
  rematch(): void {
    if (this.sim.phase !== 'FINISHED') return;
    resetForRematch(this.sim);
    this.bot.reset();
    this.playedTicks = 0;
    this.resultSent = false;
    this.moveX = 0;
    this.moveY = 0;
    this.emit({ type: 'result', result: null });
    this.publish([]);
  }

  private publish(events: readonly DuelEvent[]): void {
    this.mirror();
    for (const event of events) {
      this.emit({ type: 'event', event: toGameEventMessage(event, this.nextEventId) });
      this.nextEventId += 1;
    }
    if (this.sim.phase === 'FINISHED' && !this.resultSent) {
      this.resultSent = true;
      this.emit({
        type: 'result',
        result: buildMatchResult(this.sim, this.playedTicks * DT_MS),
      });
    }
  }

  private reject(rejection: Omit<ActionRejectedMessage, 'serverTick'>): void {
    this.emit({ type: 'rejected', rejection: { ...rejection, serverTick: this.sim.tick } });
  }

  private sendProgress(): void {
    const player = getPlayer(this.sim, LOCAL_PLAYER_ID);
    if (!player) return;
    this.emit({
      type: 'progress',
      progress: {
        playerId: player.id,
        jutsuId: player.selectedJutsuId,
        index: player.signIndex,
        required: JUTSUS[player.selectedJutsuId].signs.length,
        serverTick: this.sim.tick,
      },
    });
  }

  private emit(message: LocalMatchMessage): void {
    for (const listener of this.listeners) listener(message);
  }

  private mirror(): void {
    const { sim, state } = this;
    state.phase = sim.phase;
    state.tick = sim.tick;
    state.activeTicksRemaining = sim.activeTicksRemaining;
    state.countdownTicksRemaining = sim.countdownTicksRemaining;
    state.resuming = sim.resuming;
    state.winnerId = sim.winnerId;
    state.resultReason = sim.resultReason;
    for (const player of sim.players) state.players.set(player.id, playerView(player));
    const live = new Set<string>();
    for (const projectile of sim.projectiles) {
      const key = String(projectile.id);
      live.add(key);
      state.projectiles.set(key, {
        id: projectile.id,
        ownerId: projectile.ownerId,
        jutsuId: projectile.jutsuId,
        x: projectile.x,
        y: projectile.y,
        vx: projectile.vx,
        vy: projectile.vy,
        radius: projectile.radius,
        expiresTick: projectile.expiresTick,
      });
    }
    for (const key of [...state.projectiles.keys()]) {
      if (!live.has(key)) state.projectiles.delete(key);
    }
  }
}
