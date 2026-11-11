// Engine state snapshot and event types (docs/DESIGN.md 8.2 and 8.3).
import type { Element, JutsuId, PlayerId, SignId } from './types';

export interface PlayerStats {
  damageDealt: number;
  damageTaken: number;
  jutsusCast: Record<JutsuId, number>;
  substitutions: number;
  clashesWon: number;
  clashesLost: number;
}

export interface PlayerState {
  hp: number;
  buffer: readonly SignId[];
  /** When the buffer last changed; null while empty. Drives the reset timeout. */
  bufferUpdatedAt: number | null;
  /** Engine time when Substitution becomes usable again; 0 means ready. */
  substitutionReadyAt: number;
  stats: PlayerStats;
}

export interface Projectile {
  id: number;
  caster: PlayerId;
  jutsuId: JutsuId;
  element: Element;
  baseDamage: number;
  castAt: number;
  landsAt: number;
}

export type EndReason = 'ko' | 'timeout' | 'forfeit';

export interface MatchResult {
  /** Null on a draw. */
  winner: PlayerId | null;
  reason: EndReason;
}

export interface BattleState {
  phase: 'active' | 'ended';
  startedAt: number;
  endsAt: number;
  now: number;
  players: Readonly<Record<PlayerId, PlayerState>>;
  inFlight: readonly Projectile[];
  result: MatchResult | null;
}

export type BufferResetReason = 'timeout' | 'mismatch' | 'cast';

export type EngineEvent =
  | { type: 'signRegistered'; t: number; player: PlayerId; sign: SignId; buffer: readonly SignId[] }
  | { type: 'bufferReset'; t: number; player: PlayerId; reason: BufferResetReason }
  | {
      type: 'jutsuCast';
      t: number;
      player: PlayerId;
      jutsuId: JutsuId;
      element: Element;
      projectileId: number;
      landsAt: number;
    }
  | {
      type: 'clash';
      t: number;
      /** The projectile that was already in flight. */
      a: { projectileId: number; caster: PlayerId; multiplier: number };
      /** The projectile just cast. */
      b: { projectileId: number; caster: PlayerId; multiplier: number };
    }
  | {
      type: 'hit';
      t: number;
      target: PlayerId;
      projectileId: number;
      jutsuId: JutsuId;
      element: Element;
      damage: number;
      hpAfter: number;
      viaClash: boolean;
    }
  | { type: 'dodge'; t: number; player: PlayerId; negatedProjectileId: number }
  | {
      type: 'substitutionFailed';
      t: number;
      player: PlayerId;
      reason: 'cooldown' | 'nothingInFlight';
    }
  | { type: 'cooldownReady'; t: number; player: PlayerId }
  | { type: 'ko'; t: number; loser: PlayerId }
  | { type: 'matchEnded'; t: number; winner: PlayerId | null; reason: EndReason };

export type EngineEventType = EngineEvent['type'];
