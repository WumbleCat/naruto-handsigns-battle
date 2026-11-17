// Every tunable number of the online duel (docs/handsign-duel/ALL_IN_ONE_SPEC.md, section 02).
// Values are in world units, milliseconds and per-second rates as the spec states them; the
// simulation converts durations to whole ticks with `msToTicks` (rounded up, so a 350 ms cast
// takes 11 ticks = 367 ms at 30 Hz; see DECISIONS.md).
import type { DuelSign, JutsuId } from './types.ts';

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
