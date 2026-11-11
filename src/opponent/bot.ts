// The bot opponent (docs/DESIGN.md 8.6). A state machine ticked by the battle controller,
// with all randomness from a seeded PRNG so a match can be replayed. It reads the same
// engine events and snapshots the UI does and never touches engine internals.
import type { BotDifficultyParams } from '../content/balance.config';
import type { BotDifficulty } from '../content/types';
import { counterOf } from '../engine/elements';
import type { EngineEvent } from '../engine/events';
import {
  otherPlayer,
  SIGN_IDS,
  type Element,
  type EngineBalance,
  type JutsuDef,
  type PlayerId,
  type SignId,
} from '../engine/types';
import { Prng } from './prng';
import type { OpponentContext, OpponentSource, OpponentStatus, Unsubscribe } from './types';

export interface BotOpponentOptions {
  difficulty: BotDifficulty;
  params: BotDifficultyParams;
  roster: readonly JutsuDef[];
  balance: Pick<EngineBalance, 'flightMs' | 'elementCycle'>;
  displayName: string;
  seed?: number;
}

interface Plan {
  jutsu: JutsuDef;
  index: number;
  /** Reactions fire their first sign immediately; normal plans wait one interval. */
  reaction: boolean;
}

interface PendingReaction {
  at: number;
  jutsu: JutsuDef;
}

export class BotOpponent implements OpponentSource {
  readonly kind = 'bot' as const;
  readonly displayName: string;
  readonly mediaStream = null;
  status: OpponentStatus = 'ready';
  readonly difficulty: BotDifficulty;
  readonly seed: number;

  private readonly params: BotDifficultyParams;
  private readonly roster: readonly JutsuDef[];
  private readonly attacks: readonly JutsuDef[];
  private readonly substitution: JutsuDef | null;
  private readonly flightMs: number;
  private readonly cycle: readonly Element[];
  private readonly rng: Prng;
  private readonly signListeners = new Set<(sign: SignId, t: number) => void>();
  private readonly statusListeners = new Set<(status: OpponentStatus) => void>();

  private ctx: OpponentContext | null = null;
  private unsubscribe: Unsubscribe | null = null;
  private me: PlayerId = 'p2';
  private plan: Plan | null = null;
  private nextSignAt = 0;
  private nextPlanAt = 0;
  private pending: PendingReaction | null = null;
  private waitingForClashUntil: number | null = null;
  /** Counts the player's sequences so each one is read at most once. */
  private playerGeneration = 0;
  private reactedToGeneration = -1;
  private lastSignEmitted: SignId | null = null;

  constructor(options: BotOpponentOptions) {
    this.difficulty = options.difficulty;
    this.params = options.params;
    this.roster = options.roster;
    this.attacks = options.roster.filter((jutsu) => jutsu.kind === 'attack');
    this.substitution = options.roster.find((jutsu) => jutsu.kind === 'substitution') ?? null;
    this.flightMs = options.balance.flightMs;
    this.cycle = options.balance.elementCycle;
    this.displayName = options.displayName;
    this.seed = options.seed ?? Math.floor(Math.random() * 0xffffffff);
    this.rng = new Prng(this.seed);
  }

  onSign(listener: (sign: SignId, t: number) => void): Unsubscribe {
    this.signListeners.add(listener);
    return () => this.signListeners.delete(listener);
  }

  onStatus(listener: (status: OpponentStatus) => void): Unsubscribe {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  start(context: OpponentContext): void {
    this.ctx = context;
    this.me = otherPlayer(context.localPlayer);
    this.unsubscribe = context.subscribe(this.onEvent);
    this.nextPlanAt = context.now() + this.thinkTime();
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.ctx = null;
    this.plan = null;
    this.pending = null;
  }

  /** Called every frame with engine time. Emits at most one sign per call. */
  tick(now: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const state = ctx.getState();
    if (state.phase !== 'active') return;

    if (this.pending && now >= this.pending.at) {
      this.plan = { jutsu: this.pending.jutsu, index: 0, reaction: true };
      this.nextSignAt = now;
      this.pending = null;
      this.waitingForClashUntil = null;
    }

    if (!this.plan) {
      if (now < this.nextPlanAt) return;
      this.plan = {
        jutsu: this.choosePlan(state.players[ctx.localPlayer].buffer.length),
        index: 0,
        reaction: false,
      };
      this.nextSignAt = now + this.interval();
      return;
    }

    if (now < this.nextSignAt) return;

    const { plan } = this;
    const sign = plan.jutsu.sequence[plan.index];
    if (sign === undefined) {
      this.plan = null;
      return;
    }

    const isLastSign = plan.index === plan.jutsu.sequence.length - 1;
    if (isLastSign && this.shouldWaitForClash(now, plan, state.players[ctx.localPlayer].buffer)) {
      return;
    }
    this.waitingForClashUntil = null;

    if (plan.jutsu.kind === 'attack' && this.rng.chance(this.params.misfireChance)) {
      this.emit(this.wrongSign(sign), now);
      this.plan = null;
      this.nextPlanAt = now + this.params.thinkMinMs;
      return;
    }

    this.emit(sign, now);
    plan.index += 1;
    if (plan.index >= plan.jutsu.sequence.length) {
      this.plan = null;
      this.nextPlanAt = now + this.thinkTime();
    } else {
      this.nextSignAt = now + this.interval();
    }
  }

  // ---- reading the opponent --------------------------------------------------------------

  private onEvent = (event: EngineEvent): void => {
    const ctx = this.ctx;
    if (!ctx) return;
    const player = ctx.localPlayer;

    if (event.type === 'signRegistered' && event.player === player) {
      this.maybeCounter(event.buffer, ctx.now());
      return;
    }
    if (event.type === 'bufferReset' && event.player === player) {
      if (event.reason !== 'cast') this.playerGeneration += 1;
      return;
    }
    if (event.type === 'jutsuCast' && event.player === player) {
      this.playerGeneration += 1;
      this.maybeSubstitute(ctx.now(), ctx.getState().players[this.me].substitutionReadyAt);
    }
  };

  private maybeCounter(buffer: readonly SignId[], now: number): void {
    const threshold = this.params.readsAfterSigns;
    if (threshold === null || buffer.length < threshold) return;
    if (this.reactedToGeneration === this.playerGeneration) return;
    const element = this.elementOfOpener(buffer[0]);
    if (!element) return;
    this.reactedToGeneration = this.playerGeneration;
    const counter = counterOf(this.cycle, element);
    if (this.plan?.jutsu.kind === 'attack' && this.plan.jutsu.element === counter) return;
    if (!this.rng.chance(this.params.counterChance)) return;
    const jutsu = this.shortAttack(counter);
    if (jutsu) this.pending = { at: now + this.params.reactionMs, jutsu };
  }

  private maybeSubstitute(now: number, substitutionReadyAt: number): void {
    if (!this.substitution || substitutionReadyAt > 0) return;
    if (!this.rng.chance(this.params.substitutionChance)) return;
    this.pending = { at: now + this.params.reactionMs, jutsu: this.substitution };
  }

  /**
   * Hard bots delay their final sign while the player is one sign from completing, so the
   * bot's jutsu is cast inside the player's flight window and the clash is forced.
   */
  private shouldWaitForClash(now: number, plan: Plan, playerBuffer: readonly SignId[]): boolean {
    if (!this.params.timesClash || plan.jutsu.kind !== 'attack' || plan.reaction) return false;
    if (playerBuffer.length === 0) return false;
    const playerElement = this.elementOfOpener(playerBuffer[0]);
    if (!playerElement || counterOf(this.cycle, playerElement) !== plan.jutsu.element) return false;
    const candidate = this.roster.find(
      (jutsu) =>
        jutsu.sequence.length > playerBuffer.length &&
        playerBuffer.every((sign, index) => jutsu.sequence[index] === sign),
    );
    const oneAway =
      candidate !== undefined && candidate.sequence.length - playerBuffer.length === 1;
    if (!oneAway) return false;
    this.waitingForClashUntil ??= now + this.flightMs;
    return now < this.waitingForClashUntil;
  }

  // ---- choices ---------------------------------------------------------------------------

  private choosePlan(playerBufferLength: number): JutsuDef {
    const preferLong =
      playerBufferLength === 0
        ? this.params.longPreferenceWhenPlayerIdle
        : this.params.longPreference;
    const element = this.rng.pick(this.cycle);
    const options = this.attacks.filter((jutsu) => jutsu.element === element);
    const sorted = [...options].sort((a, b) => a.sequence.length - b.sequence.length);
    const short = sorted[0];
    const long = sorted[sorted.length - 1];
    const choice = this.rng.chance(preferLong) ? long : short;
    if (!choice) throw new Error(`No attack for element ${element}`);
    return choice;
  }

  private shortAttack(element: Element): JutsuDef | null {
    const options = this.attacks.filter((jutsu) => jutsu.element === element);
    return [...options].sort((a, b) => a.sequence.length - b.sequence.length)[0] ?? null;
  }

  private elementOfOpener(sign: SignId | undefined): Element | null {
    if (!sign) return null;
    const jutsu = this.attacks.find((candidate) => candidate.sequence[0] === sign);
    return jutsu?.element ?? null;
  }

  private wrongSign(planned: SignId): SignId {
    const choices = SIGN_IDS.filter((sign) => sign !== planned && sign !== this.lastSignEmitted);
    return this.rng.pick(choices);
  }

  private interval(): number {
    const { signIntervalMs, signJitterMs } = this.params;
    return Math.max(50, signIntervalMs + this.rng.range(-signJitterMs, signJitterMs));
  }

  private thinkTime(): number {
    return this.rng.range(this.params.thinkMinMs, this.params.thinkMaxMs);
  }

  private emit(sign: SignId, t: number): void {
    this.lastSignEmitted = sign;
    for (const listener of this.signListeners) listener(sign, t);
  }
}
