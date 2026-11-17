// One room per 1v1 match. The room owns a DuelSim, validates every client message, feeds the
// simulation between ticks, steps it at 30 Hz with Colyseus's fixed timestep, mirrors the
// result into the synced state (~15 Hz patches) and broadcasts transient events. Clients only
// ever send requests; nothing they send is written into the state directly.
import { Room, ServerError, type Client, type StepContext } from 'colyseus';
import {
  addPlayer,
  beginCountdown,
  canStart,
  cancelSigns,
  CLIENT_MESSAGES,
  createDuelSim,
  DT_MS,
  DUEL_CONFIG,
  dodgeRequestSchema,
  forfeit,
  getOpponent,
  getPlayer,
  joinOptionsSchema,
  JUTSUS,
  MoveInput,
  msToTicks,
  observeSign,
  pauseForReconnect,
  readySchema,
  rematchVoteSchema,
  removePlayer,
  requestDodge,
  resetForRematch,
  selectJutsu,
  selectJutsuSchema,
  SERVER_MESSAGES,
  setMoveInput,
  setReady,
  signSchema,
  stepDuel,
  type ActionRejectedMessage,
  type DuelEvent,
  type DuelSim,
  type DuelTimings,
  type GameEventMessage,
  type MatchResultMessage,
  type RoomNoticeMessage,
  type SignProgressMessage,
} from '@jutsu-duel/duel-shared';
import { RecentIds, TokenBucket } from '../security/limits.ts';
import { DuelState, syncState } from '../state/DuelState.ts';

/**
 * Shorter timings for automated tests. Honoured only when the process opts in through
 * DUEL_ALLOW_TEST_TIMINGS=true, so a production room ignores them.
 */
export interface DuelRoomCreateOptions {
  testTimings?: Partial<DuelTimings> & { reconnectGraceMs?: number };
}

export const TEST_TIMINGS_ALLOWED = process.env.DUEL_ALLOW_TEST_TIMINGS === 'true';

interface ConnectionGuards {
  signs: TokenBucket;
  actions: TokenBucket;
  recentIds: RecentIds;
}

type LivePhase = 'COUNTDOWN' | 'PLAYING' | 'PAUSED_RECONNECT';

function isLive(sim: DuelSim): boolean {
  return (['COUNTDOWN', 'PLAYING', 'PAUSED_RECONNECT'] as LivePhase[]).includes(
    sim.phase as LivePhase,
  );
}

export class DuelRoom extends Room<{ state: DuelState; input: MoveInput }> {
  maxClients = DUEL_CONFIG.match.maxPlayers;
  patchRate = DUEL_CONFIG.patchRateMs;
  autoDispose = true;
  state = new DuelState();
  inputs = this.defineInput(MoveInput, {
    sanitize: { moveX: [-1, 1], moveY: [-1, 1] },
    idle: { moveX: 0, moveY: 0 },
    bufferMaxSize: 8,
  });

  private sim: DuelSim = createDuelSim();
  private guards = new Map<string, ConnectionGuards>();
  private nextEventId = 1;
  private resultSent = false;
  private reconnectGraceMs: number = DUEL_CONFIG.match.reconnectGraceMs;
  private graceTimers = new Map<string, { clear: () => void }>();
  private playedTicks = 0;

  onCreate(options: DuelRoomCreateOptions = {}): void {
    if (TEST_TIMINGS_ALLOWED && options.testTimings) {
      const { reconnectGraceMs, ...timings } = options.testTimings;
      this.sim = createDuelSim(timings);
      if (reconnectGraceMs !== undefined) this.reconnectGraceMs = reconnectGraceMs;
    }
    this.state.tickRate = DUEL_CONFIG.tickRate;
    void this.setPrivate(true);

    this.handle(CLIENT_MESSAGES.READY, readySchema, 'ready', (client, message) => {
      if (!this.takeAction(client, 'ready')) return;
      if (!setReady(this.sim, client.sessionId, message.ready)) {
        this.reject(client, { action: 'ready', reason: 'not_playing' });
        return;
      }
      if (canStart(this.sim)) this.startCountdown();
      this.sync();
    });

    this.handle(CLIENT_MESSAGES.DODGE_REQUEST, dodgeRequestSchema, 'dodge', (client, message) => {
      const guard = this.guardFor(client);
      if (!guard.actions.take(this.clock.currentTime)) {
        this.reject(client, {
          action: 'dodge',
          actionId: message.actionId,
          reason: 'rate_limited',
        });
        return;
      }
      if (!guard.recentIds.add(message.actionId)) {
        this.reject(client, { action: 'dodge', actionId: message.actionId, reason: 'duplicate' });
        return;
      }
      const { result, event } = requestDodge(this.sim, client.sessionId);
      if (!result.ok)
        this.reject(client, { action: 'dodge', actionId: message.actionId, reason: result.reason });
      if (event) this.publish(event);
    });

    this.handle(CLIENT_MESSAGES.SELECT_JUTSU, selectJutsuSchema, 'select', (client, message) => {
      if (!this.takeAction(client, 'select')) return;
      const result = selectJutsu(this.sim, client.sessionId, message.jutsuId);
      if (!result.ok) {
        this.reject(client, { action: 'select', reason: result.reason });
        return;
      }
      this.sendProgress(client);
    });

    this.handle(CLIENT_MESSAGES.SIGN, signSchema, 'sign', (client, message) => {
      const guard = this.guardFor(client);
      const now = this.clock.currentTime;
      if (!guard.signs.take(now)) {
        this.reject(client, { action: 'sign', actionId: message.eventId, reason: 'rate_limited' });
        return;
      }
      if (!guard.recentIds.add(message.eventId)) {
        this.reject(client, { action: 'sign', actionId: message.eventId, reason: 'duplicate' });
        return;
      }
      if (message.confidence < DUEL_CONFIG.signs.minConfidence) {
        this.reject(client, { action: 'sign', actionId: message.eventId, reason: 'invalid' });
        return;
      }
      const { result, event } = observeSign(this.sim, client.sessionId, message.sign, now);
      if (!result.ok) {
        this.reject(client, { action: 'sign', actionId: message.eventId, reason: result.reason });
        this.sendProgress(client);
        return;
      }
      this.sendProgress(client);
      if (result.cast && !result.cast.ok) {
        this.reject(client, {
          action: 'cast',
          actionId: message.eventId,
          reason: result.cast.reason,
        });
      }
      if (event) this.publish(event);
    });

    this.onMessage(CLIENT_MESSAGES.CANCEL_SIGNS, (client) => {
      if (!this.takeAction(client, 'sign')) return;
      cancelSigns(this.sim, client.sessionId);
      this.sendProgress(client);
    });

    this.handle(CLIENT_MESSAGES.REMATCH_VOTE, rematchVoteSchema, 'rematch', (client, message) => {
      if (!this.takeAction(client, 'rematch')) return;
      const player = getPlayer(this.sim, client.sessionId);
      if (!player || this.sim.phase !== 'FINISHED') {
        this.reject(client, { action: 'rematch', reason: 'not_playing' });
        return;
      }
      player.rematchVote = message.accept;
      if (!message.accept) {
        this.notice({
          code: 'rematch_declined',
          message: `${player.nickname} declined a rematch.`,
        });
      } else if (
        this.sim.players.length === 2 &&
        this.sim.players.every((p) => p.rematchVote && p.connected)
      ) {
        resetForRematch(this.sim);
        this.resultSent = false;
        this.playedTicks = 0;
        this.notice({ code: 'resuming', message: 'Rematch accepted. Get ready.' });
      } else {
        this.notice({ code: 'rematch_pending', message: `${player.nickname} wants a rematch.` });
      }
      this.sync();
    });

    this.onMessage(CLIENT_MESSAGES.LEAVE, (client) => {
      void client.leave();
    });

    // Unknown message types are logged and ignored: there is no path for a client to set hp,
    // damage, position or a winner. A flood of any kind closes the connection.
    this.onMessage('*', (client, type) => {
      console.warn(
        `[duel] ${this.roomId} ignored unknown message "${String(type)}" from ${client.sessionId}`,
      );
    });
    this.maxMessagesPerSecond = 240;

    this.setFixedTimestep((ctx) => this.step(ctx), DUEL_CONFIG.tickRate);
    this.sync();
  }

  /**
   * Registers a handler whose payload is validated here rather than by Colyseus, so a malformed
   * message earns an ACTION_REJECTED reply instead of a dropped connection.
   */
  private handle<T>(
    type: string,
    schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false } },
    action: ActionRejectedMessage['action'],
    handler: (client: Client, message: T) => void,
  ): void {
    this.onMessage(type, (client, raw: unknown) => {
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        this.reject(client, { action, reason: 'invalid' });
        return;
      }
      handler(client, parsed.data);
    });
  }

  onAuth(_client: Client, options: unknown): { nickname: string; inputMode: 'mock' | 'webcam' } {
    const parsed = joinOptionsSchema.safeParse(options);
    if (!parsed.success)
      throw new ServerError(400, 'A nickname of 1 to 16 characters is required.');
    if (this.sim.phase !== 'WAITING' && this.sim.phase !== 'READY') {
      throw new ServerError(409, 'This duel has already started.');
    }
    if (this.sim.players.length >= DUEL_CONFIG.match.maxPlayers) {
      throw new ServerError(409, 'This duel is full.');
    }
    return parsed.data;
  }

  onJoin(client: Client, _options: unknown, auth?: { nickname: string }): void {
    const nickname =
      auth?.nickname ?? (client.auth as { nickname?: string } | undefined)?.nickname ?? 'Player';
    const player = addPlayer(this.sim, client.sessionId, nickname);
    if (!player) {
      void client.leave(4000);
      return;
    }
    this.guards.set(client.sessionId, {
      signs: new TokenBucket(
        DUEL_CONFIG.limits.signEventsPerSecond,
        DUEL_CONFIG.limits.signBurst,
        this.clock.currentTime,
      ),
      actions: new TokenBucket(
        DUEL_CONFIG.limits.actionsPerSecond,
        DUEL_CONFIG.limits.actionBurst,
        this.clock.currentTime,
      ),
      recentIds: new RecentIds(DUEL_CONFIG.limits.recentIdsRemembered),
    });
    const opponent = getOpponent(this.sim, client.sessionId);
    if (opponent) {
      this.noticeTo(opponent.id, {
        code: 'opponent_joined',
        message: `${nickname} joined the duel.`,
      });
    }
    this.sync();
  }

  onDrop(client: Client): void {
    const player = getPlayer(this.sim, client.sessionId);
    if (!player) return;
    player.connected = false;
    player.ready = false;
    if (!isLive(this.sim)) {
      this.sync();
      return; // In the lobby or after the result a drop is a plain leave; onLeave follows.
    }
    player.disconnects += 1;
    if (player.disconnects >= 2) {
      this.endByForfeit(player.id);
      return;
    }
    pauseForReconnect(this.sim);
    const opponent = getOpponent(this.sim, player.id);
    if (opponent) {
      this.noticeTo(opponent.id, {
        code: 'opponent_disconnected',
        message: `${player.nickname} lost connection. Waiting up to ${Math.round(this.reconnectGraceMs / 1000)} s.`,
        graceMs: this.reconnectGraceMs,
      });
    }
    const reconnection = this.allowReconnection(client, 'manual');
    const expire = reconnection.reject as () => void;
    const timer = this.clock.setTimeout(() => {
      this.graceTimers.delete(client.sessionId);
      expire();
    }, this.reconnectGraceMs);
    this.graceTimers.set(client.sessionId, timer);
    reconnection.catch(() => undefined);
    this.sync();
  }

  onReconnect(client: Client): void {
    this.clearGrace(client.sessionId);
    const player = getPlayer(this.sim, client.sessionId);
    if (!player) return;
    player.connected = true;
    const opponent = getOpponent(this.sim, player.id);
    if (opponent) {
      this.noticeTo(opponent.id, {
        code: 'opponent_reconnected',
        message: `${player.nickname} is back.`,
      });
    }
    this.noticeTo(player.id, { code: 'resuming', message: 'Reconnected. Resuming shortly.' });
    if (this.sim.phase === 'PAUSED_RECONNECT') beginCountdown(this.sim, true);
    this.sync();
  }

  onLeave(client: Client): void {
    this.clearGrace(client.sessionId);
    const player = getPlayer(this.sim, client.sessionId);
    if (!player) return;
    if (isLive(this.sim)) {
      this.endByForfeit(player.id);
    }
    const opponent = getOpponent(this.sim, player.id);
    removePlayer(this.sim, player.id);
    this.guards.delete(client.sessionId);
    if (opponent) {
      this.noticeTo(opponent.id, {
        code: 'opponent_left',
        message: `${player.nickname} left the duel.`,
      });
    }
    this.sync();
  }

  onDispose(): void {
    for (const timer of this.graceTimers.values()) timer.clear();
    this.graceTimers.clear();
  }

  /** The room's authoritative simulation, for integration tests. */
  get simulation(): DuelSim {
    return this.sim;
  }

  private step(_ctx: StepContext): void {
    const sim = this.sim;
    if (sim.phase === 'PLAYING') {
      for (const player of sim.players) {
        const input = this.inputs.get(player.id).next();
        setMoveInput(sim, player.id, input.moveX, input.moveY);
      }
    }
    const wasPlaying = sim.phase === 'PLAYING';
    const events = stepDuel(sim);
    if (wasPlaying) this.playedTicks += 1;
    // Inputs sent during a countdown or pause are stale by the time play (re)starts.
    if (!wasPlaying && sim.phase === 'PLAYING') {
      for (const player of sim.players) this.inputs.get(player.id).clear();
    }
    for (const event of events) this.publish(event);
    this.sync();
  }

  private startCountdown(): void {
    beginCountdown(this.sim);
    this.playedTicks = 0;
    this.resultSent = false;
    void this.lock();
  }

  private endByForfeit(loserId: string): void {
    const event = forfeit(this.sim, loserId);
    if (event) this.publish(event);
    this.sync();
  }

  private clearGrace(sessionId: string): void {
    const timer = this.graceTimers.get(sessionId);
    if (timer) {
      timer.clear();
      this.graceTimers.delete(sessionId);
    }
  }

  private sync(): void {
    syncState(this.state, this.sim);
  }

  private guardFor(client: Client): ConnectionGuards {
    let guard = this.guards.get(client.sessionId);
    if (!guard) {
      guard = {
        signs: new TokenBucket(
          DUEL_CONFIG.limits.signEventsPerSecond,
          DUEL_CONFIG.limits.signBurst,
          this.clock.currentTime,
        ),
        actions: new TokenBucket(
          DUEL_CONFIG.limits.actionsPerSecond,
          DUEL_CONFIG.limits.actionBurst,
          this.clock.currentTime,
        ),
        recentIds: new RecentIds(DUEL_CONFIG.limits.recentIdsRemembered),
      };
      this.guards.set(client.sessionId, guard);
    }
    return guard;
  }

  private takeAction(client: Client, action: ActionRejectedMessage['action']): boolean {
    if (this.guardFor(client).actions.take(this.clock.currentTime)) return true;
    this.reject(client, { action, reason: 'rate_limited' });
    return false;
  }

  private reject(client: Client, rejection: Omit<ActionRejectedMessage, 'serverTick'>): void {
    const message: ActionRejectedMessage = { ...rejection, serverTick: this.sim.tick };
    client.send(SERVER_MESSAGES.ACTION_REJECTED, message);
  }

  private sendProgress(client: Client): void {
    const player = getPlayer(this.sim, client.sessionId);
    if (!player) return;
    const message: SignProgressMessage = {
      playerId: player.id,
      jutsuId: player.selectedJutsuId,
      index: player.signIndex,
      required: JUTSUS[player.selectedJutsuId].signs.length,
      serverTick: this.sim.tick,
    };
    client.send(SERVER_MESSAGES.SIGN_PROGRESS, message);
  }

  private notice(notice: RoomNoticeMessage): void {
    this.broadcast(SERVER_MESSAGES.ROOM_NOTICE, notice);
  }

  private noticeTo(playerId: string, notice: RoomNoticeMessage): void {
    const client = this.clients.find((c) => c.sessionId === playerId);
    client?.send(SERVER_MESSAGES.ROOM_NOTICE, notice);
  }

  private publish(event: DuelEvent): void {
    const { type, tick, ...rest } = event;
    const data: Record<string, number | string | boolean> = {};
    let actorId: string | undefined;
    let targetId: string | undefined;
    for (const [key, value] of Object.entries(rest)) {
      if (key === 'actorId') actorId = String(value);
      else if (key === 'targetId') targetId = String(value);
      else if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean')
        data[key] = value;
    }
    const message: GameEventMessage = {
      eventId: this.nextEventId,
      tick,
      type,
      actorId,
      targetId,
      data,
    };
    this.nextEventId += 1;
    this.broadcast(SERVER_MESSAGES.GAME_EVENT, message);
    if (type === 'MATCH_ENDED') this.sendResult();
  }

  private sendResult(): void {
    if (this.resultSent) return;
    this.resultSent = true;
    const sim = this.sim;
    const message: MatchResultMessage = {
      winnerId: sim.winnerId,
      reason: sim.resultReason,
      elapsedMs: this.playedTicks * DT_MS,
      tick: sim.tick,
      players: sim.players.map((p) => ({
        playerId: p.id,
        nickname: p.nickname,
        slot: p.slot,
        hpLeft: Math.round(p.hp),
        damageDealt: p.stats.damageDealt,
        damageTaken: p.stats.damageTaken,
        casts: { ...p.stats.casts },
        dodgesUsed: p.stats.dodgesUsed,
        dodgesSuccessful: p.stats.dodgesSuccessful,
        shieldAbsorbed: p.stats.shieldAbsorbed,
      })),
    };
    this.broadcast(SERVER_MESSAGES.MATCH_RESULT, message);
    // Dispose a finished room that nobody rematches within the full match length.
    this.clock.setTimeout(
      () => {
        if (this.sim.phase === 'FINISHED') void this.disconnect();
      },
      msToTicks(DUEL_CONFIG.match.durationMs) * DT_MS,
    );
  }
}
