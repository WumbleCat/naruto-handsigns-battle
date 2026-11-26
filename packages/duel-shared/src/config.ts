// Every tunable number of the online duel (docs/handsign-duel/ALL_IN_ONE_SPEC.md, section 02).
// Values are in world units, milliseconds and per-second rates as the spec states them; the
// simulation converts durations to whole ticks with `msToTicks` (rounded up, so a 350 ms cast
// takes 11 ticks = 367 ms at 30 Hz; see DECISIONS.md).
import type { BotLevel, DuelSign, JutsuId } from './types.ts';

export const DUEL_CONFIG = {
  version: 1,
  tickRate: 30,
  patchRateMs: 66,
  arena: { width: 1200, height: 700 },
  player: {
    radius: 22,
    speed: 220,
    castMoveMultiplier: 0.5,
    spawns: [
      { x: 150, y: 350 },
      { x: 1050, y: 350 },
    ],
  },
  match: {
    durationMs: 180_000,
    countdownMs: 3000,
    resumeCountdownMs: 2000,
    reconnectGraceMs: 10_000,
    maxPlayers: 2,
  },
  resources: {
    maxHp: 100,
    maxChakra: 100,
    maxStamina: 100,
    hpRegenPerSec: 2,
    hpRegenDelayMs: 6000,
    chakraRegenPerSec: 7,
    staminaRegenPerSec: 20,
  },
  dodge: {
    staminaCost: 35,
    cooldownMs: 1500,
    durationMs: 180,
    distance: 150,
    invulnStartMs: 30,
    invulnEndMs: 150,
  },
  cast: { projectileSpawnOffset: 40 },
  signs: { minGapMs: 120, maxGapMs: 3000, minConfidence: 0.8, holdMs: 150 },
  limits: {
    nicknameMaxLength: 16,
    signEventsPerSecond: 12,
    signBurst: 4,
    actionsPerSecond: 20,
    actionBurst: 8,
    recentIdsRemembered: 64,
  },
} as const;

export const DT = 1 / DUEL_CONFIG.tickRate;
export const DT_MS = 1000 / DUEL_CONFIG.tickRate;

/** Whole ticks covering `ms` (rounded up so a window is never shorter than specified). */
export function msToTicks(ms: number): number {
  return Math.ceil(ms / DT_MS - 1e-9);
}

export interface ProjectileJutsuDef {
  kind: 'projectile';
  id: JutsuId;
  slot: 1 | 2 | 3;
  name: string;
  signs: readonly DuelSign[];
  chakra: number;
  castMs: number;
  cooldownMs: number;
  damage: number;
  speed: number;
  radius: number;
  lifetimeMs: number;
}

export interface ShieldJutsuDef {
  kind: 'shield';
  id: JutsuId;
  slot: 1 | 2 | 3;
  name: string;
  signs: readonly DuelSign[];
  chakra: number;
  castMs: number;
  cooldownMs: number;
  absorb: number;
  durationMs: number;
}

export type JutsuDef = ProjectileJutsuDef | ShieldJutsuDef;

export const JUTSUS: Readonly<Record<JutsuId, JutsuDef>> = {
  fireball: {
    kind: 'projectile',
    id: 'fireball',
    slot: 1,
    name: 'Fireball',
    signs: ['tiger', 'boar', 'horse'],
    chakra: 30,
    castMs: 350,
    cooldownMs: 5000,
    damage: 28,
    speed: 500,
    radius: 24,
    lifetimeMs: 1400,
  },
  lightning_spear: {
    kind: 'projectile',
    id: 'lightning_spear',
    slot: 2,
    name: 'Lightning Spear',
    signs: ['rat', 'bird', 'tiger'],
    chakra: 45,
    castMs: 500,
    cooldownMs: 8000,
    damage: 40,
    speed: 900,
    radius: 12,
    lifetimeMs: 950,
  },
  water_shield: {
    kind: 'shield',
    id: 'water_shield',
    slot: 3,
    name: 'Water Shield',
    signs: ['snake', 'ram'],
    chakra: 25,
    castMs: 250,
    cooldownMs: 9000,
    absorb: 38,
    durationMs: 2500,
  },
};

/** Jutsu in slot order, so slot keys 1/2/3 map by index. */
export const JUTSU_BY_SLOT: readonly JutsuId[] = ['fireball', 'lightning_spear', 'water_shield'];

/**
 * How one difficulty of the offline bot plays. The bot goes through the same requests as a
 * player (move, dodge, select, sign), so these only shape its decisions, never the rules.
 */
export interface BotParams {
  name: string;
  /** One line for the difficulty picker. */
  summary: string;
  /** Time between two signs of a sequence, plus or minus the jitter. */
  signIntervalMs: number;
  signJitterMs: number;
  /** Chance per sign of weaving the wrong one, which resets the sequence. */
  misfireChance: number;
  /** Pause between finishing one jutsu and starting the next. */
  thinkMinMs: number;
  thinkMaxMs: number;
  /** Delay before the bot acts on a projectile or an opponent's wind-up. */
  reactionMs: number;
  /** Chance, per incoming projectile, that the bot tries to get out of its way. */
  evadeChance: number;
  /** Chance, per opponent wind-up, that the bot answers with the shield. */
  shieldChance: number;
  /** Chance of picking the strongest affordable projectile over the cheapest. */
  heavyChance: number;
  /** Distance band to the opponent the bot tries to hold. */
  rangeMin: number;
  rangeMax: number;
  /** Chance of standing still for one movement interval instead of strafing. */
  restChance: number;
  strafeMinMs: number;
  strafeMaxMs: number;
  /** False: stands still while weaving, as a player with both hands on a sign does. */
  movesWhileWeaving: boolean;
  /**
   * Longest the bot holds its last sign waiting for an opening (opponent slowed by a cast,
   * standing still, or close). Zero casts as soon as the sequence is ready.
   */
  holdForOpeningMs: number;
}

export const BOT_PARAMS: Readonly<Record<BotLevel, BotParams>> = {
  easy: {
    name: 'Easy bot',
    summary: 'Slow signs, stands still to weave, rarely dodges.',
    signIntervalMs: 950,
    signJitterMs: 250,
    misfireChance: 0.15,
    thinkMinMs: 3200,
    thinkMaxMs: 6000,
    reactionMs: 600,
    evadeChance: 0.15,
    shieldChance: 0,
    heavyChance: 0.15,
    rangeMin: 380,
    rangeMax: 640,
    restChance: 0.55,
    strafeMinMs: 900,
    strafeMaxMs: 2200,
    movesWhileWeaving: false,
    holdForOpeningMs: 0,
  },
  normal: {
    name: 'Normal bot',
    summary: 'Steady signs, strafes between casts, dodges about half of what you throw.',
    signIntervalMs: 520,
    signJitterMs: 140,
    misfireChance: 0.05,
    thinkMinMs: 900,
    thinkMaxMs: 2000,
    reactionMs: 340,
    evadeChance: 0.55,
    shieldChance: 0.25,
    heavyChance: 0.5,
    rangeMin: 260,
    rangeMax: 460,
    restChance: 0.2,
    strafeMinMs: 600,
    strafeMaxMs: 1600,
    movesWhileWeaving: false,
    holdForOpeningMs: 0,
  },
  hard: {
    name: 'Hard bot',
    summary: 'Fast signs on the move, closes in, shields, and waits for an opening to cast.',
    signIntervalMs: 260,
    signJitterMs: 60,
    misfireChance: 0.01,
    thinkMinMs: 350,
    thinkMaxMs: 900,
    reactionMs: 220,
    evadeChance: 0.75,
    shieldChance: 0.5,
    heavyChance: 0.8,
    rangeMin: 170,
    rangeMax: 300,
    restChance: 0.1,
    strafeMinMs: 400,
    strafeMaxMs: 1100,
    movesWhileWeaving: true,
    holdForOpeningMs: 1800,
  },
};

/** Numbers every difficulty shares. */
export const BOT_TUNING = {
  /** A dodge is started this long before impact so the invulnerable window covers the hit. */
  dodgeLeadMs: 100,
  /** Extra clearance around a projectile's path before the bot considers itself safe. */
  threatMarginUnits: 14,
  /** An opponent slower than this (units per second) counts as standing still. */
  stillSpeed: 40,
  /** Inside this distance a projectile lands before a walking target can step out of it. */
  pointBlankUnits: 170,
  /** Retry delay when no jutsu is affordable or ready. */
  retryMs: 300,
} as const;
