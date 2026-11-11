// Opponent contract (docs/DESIGN.md 8.5). The battle page never knows whether it is fighting
// the bot or a remote player; both produce registered signs for the opponent's engine slot.
import type { BattleState, EngineEvent } from '../engine/events';
import type { PlayerId, SignId } from '../engine/types';

export type OpponentKind = 'bot' | 'remote';
export type OpponentStatus = 'connecting' | 'ready' | 'disconnected';

export type Unsubscribe = () => void;

/** What the battle controller hands an opponent when the match starts. */
export interface OpponentContext {
  /** The slot the human plays in; the opponent plays the other one. */
  localPlayer: PlayerId;
  /** Engine time (ms), already adjusted for pauses. */
  now: () => number;
  getState: () => BattleState;
  subscribe: (listener: (event: EngineEvent) => void) => Unsubscribe;
}

export interface OpponentSource {
  readonly kind: OpponentKind;
  readonly displayName: string;
  /** Null for the bot, which shows an avatar instead of video. */
  readonly mediaStream: MediaStream | null;
  readonly status: OpponentStatus;
  start(context: OpponentContext): void;
  stop(): void;
  /** Sources driven by a clock (the bot) advance here; the controller calls it every frame. */
  tick?(now: number): void;
  onSign(listener: (sign: SignId, t: number) => void): Unsubscribe;
  onStatus(listener: (status: OpponentStatus) => void): Unsubscribe;
}
