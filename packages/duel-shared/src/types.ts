// Identifiers shared by the duel server and client. Pure data, no runtime dependencies.

/** The seven signs the duel uses. They are a subset of the twelve the recognition model knows. */
export const DUEL_SIGNS = ['tiger', 'boar', 'horse', 'rat', 'bird', 'snake', 'ram'] as const;
export type DuelSign = (typeof DUEL_SIGNS)[number];

export function isDuelSign(value: unknown): value is DuelSign {
  return typeof value === 'string' && (DUEL_SIGNS as readonly string[]).includes(value);
}

export const JUTSU_IDS = ['fireball', 'lightning_spear', 'water_shield'] as const;
export type JutsuId = (typeof JUTSU_IDS)[number];

export function isJutsuId(value: unknown): value is JutsuId {
  return typeof value === 'string' && (JUTSU_IDS as readonly string[]).includes(value);
}

export const MATCH_PHASES = [
  'WAITING',
  'READY',
  'COUNTDOWN',
  'PLAYING',
  'PAUSED_RECONNECT',
  'FINISHED',
] as const;
export type MatchPhase = (typeof MATCH_PHASES)[number];

export type ResultReason = '' | 'ko' | 'timeout' | 'forfeit' | 'draw' | 'abandoned';

export type InputMode = 'mock' | 'webcam';

export type PlayerSlot = 1 | 2;

/** Shape of one synced player as the client reads it from the room state. */
export interface PlayerNetState {
  id: string;
  nickname: string;
  slot: number;
  connected: boolean;
  ready: boolean;
  rematchVote: boolean;
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
  selectedJutsuId: string;
  signIndex: number;
  castJutsuId: string;
  castEndsTick: number;
  fireballReadyTick: number;
  lightningReadyTick: number;
  shieldReadyTick: number;
  alive: boolean;
}

export interface ProjectileNetState {
  id: number;
  ownerId: string;
  jutsuId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  expiresTick: number;
}

/** Shape of the synced room state. Colyseus decodes it by reflection; the client reads it as this. */
export interface DuelNetState {
  phase: MatchPhase;
  tick: number;
  tickRate: number;
  activeTicksRemaining: number;
  countdownTicksRemaining: number;
  resuming: boolean;
  winnerId: string;
  resultReason: ResultReason;
  players: ReadonlyMap<string, PlayerNetState>;
  projectiles: ReadonlyMap<string, ProjectileNetState>;
}

/** Difficulty levels of the offline bot opponent, weakest first. */
export const BOT_LEVELS = ['easy', 'normal', 'hard'] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

export function isBotLevel(value: unknown): value is BotLevel {
  return typeof value === 'string' && (BOT_LEVELS as readonly string[]).includes(value);
}
