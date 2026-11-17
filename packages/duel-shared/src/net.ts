// Wire contracts between the duel client and server (docs spec section 04). Client messages are
// validated on the server with these zod schemas; the server's messages are typed here so the
// client reads them without guessing.
import { z } from 'zod';
import { DUEL_CONFIG } from './config.ts';
import type { RejectReason } from './simulation.ts';
import { DUEL_SIGNS, JUTSU_IDS, type DuelSign, type JutsuId, type ResultReason } from './types.ts';

export const DUEL_ROOM_NAME = 'duel';

/** Client to server message names. */
export const CLIENT_MESSAGES = {
  READY: 'READY',
  DODGE_REQUEST: 'DODGE_REQUEST',
  SELECT_JUTSU: 'SELECT_JUTSU',
  SIGN: 'SIGN',
  CANCEL_SIGNS: 'CANCEL_SIGNS',
  REMATCH_VOTE: 'REMATCH_VOTE',
  LEAVE: 'LEAVE',
} as const;

/** Server to client message names. */
export const SERVER_MESSAGES = {
  ACTION_REJECTED: 'ACTION_REJECTED',
  SIGN_PROGRESS: 'SIGN_PROGRESS',
  GAME_EVENT: 'GAME_EVENT',
  MATCH_RESULT: 'MATCH_RESULT',
  ROOM_NOTICE: 'ROOM_NOTICE',
} as const;

const id = z.string().min(1).max(64);

export const joinOptionsSchema = z.object({
  nickname: z.string().trim().min(1).max(DUEL_CONFIG.limits.nicknameMaxLength),
  inputMode: z.enum(['mock', 'webcam']).default('mock'),
});
export type JoinOptions = z.infer<typeof joinOptionsSchema>;

export const readySchema = z.object({ ready: z.boolean() });
export const dodgeRequestSchema = z.object({ actionId: id });
export const selectJutsuSchema = z.object({ jutsuId: z.enum(JUTSU_IDS) });
export const signSchema = z.object({
  sign: z.enum(DUEL_SIGNS),
  confidence: z.number().min(0).max(1),
  eventId: id,
  clientObservedMs: z.number().finite().nonnegative(),
});
export const cancelSignsSchema = z.object({}).optional();
export const rematchVoteSchema = z.object({ accept: z.boolean() });
export const leaveSchema = z.object({}).optional();

export type ReadyMessage = z.infer<typeof readySchema>;
export type DodgeRequestMessage = z.infer<typeof dodgeRequestSchema>;
export type SelectJutsuMessage = z.infer<typeof selectJutsuSchema>;
export type SignMessage = z.infer<typeof signSchema>;
export type RematchVoteMessage = z.infer<typeof rematchVoteSchema>;

export interface ActionRejectedMessage {
  actionId?: string;
  action: 'dodge' | 'cast' | 'sign' | 'select' | 'ready' | 'rematch';
  reason: RejectReason | 'rate_limited' | 'duplicate' | 'invalid';
  serverTick: number;
}

export interface SignProgressMessage {
  playerId: string;
  jutsuId: JutsuId;
  index: number;
  required: number;
  serverTick: number;
}

export interface GameEventMessage {
  eventId: number;
  tick: number;
  type:
    | 'MATCH_STARTED'
    | 'DODGE_STARTED'
    | 'CAST_STARTED'
    | 'CAST_RELEASED'
    | 'SHIELD_ON'
    | 'SHIELD_OFF'
    | 'HIT'
    | 'PROJECTILE_EXPIRED'
    | 'KO'
    | 'MATCH_ENDED';
  actorId?: string;
  targetId?: string;
  data?: Record<string, number | string | boolean>;
}

export interface MatchPlayerStats {
  playerId: string;
  nickname: string;
  slot: number;
  hpLeft: number;
  damageDealt: number;
  damageTaken: number;
  casts: Record<JutsuId, number>;
  dodgesUsed: number;
  dodgesSuccessful: number;
  shieldAbsorbed: number;
}

export interface MatchResultMessage {
  winnerId: string;
  reason: ResultReason;
  elapsedMs: number;
  tick: number;
  players: MatchPlayerStats[];
}

export type RoomNoticeCode =
  | 'opponent_joined'
  | 'opponent_left'
  | 'opponent_disconnected'
  | 'opponent_reconnected'
  | 'paused'
  | 'resuming'
  | 'rematch_pending'
  | 'rematch_declined';

export interface RoomNoticeMessage {
  code: RoomNoticeCode;
  message: string;
  graceMs?: number;
}

/** Human-readable reasons for the HUD. */
export const REJECT_TEXT: Readonly<Record<ActionRejectedMessage['reason'], string>> = {
  not_playing: 'The match is not running.',
  dead: 'You are down.',
  already_dodging: 'Already dodging.',
  casting: 'Cannot do that mid-cast.',
  insufficient_stamina: 'Not enough stamina.',
  dodge_cooldown: 'Dodge is cooling down.',
  unknown_jutsu: 'Unknown jutsu.',
  sequence_in_progress: 'Finish or cancel the current signs first.',
  wrong_sign: 'Wrong sign. Sequence reset.',
  sign_too_fast: 'Signs too fast. Hold each one.',
  sign_timeout: 'Too slow. Sequence reset.',
  insufficient_chakra: 'Not enough chakra.',
  jutsu_cooldown: 'That jutsu is cooling down.',
  unknown_player: 'Unknown player.',
  rate_limited: 'Too many actions. Slow down.',
  duplicate: 'Duplicate action ignored.',
  invalid: 'Invalid request.',
};

export const DUEL_SIGN_LIST: readonly DuelSign[] = DUEL_SIGNS;
