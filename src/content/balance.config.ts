// Every tunable number in the game lives here (docs/DESIGN.md sections 5.6 and 8.6).
// The engine receives the EngineBalance slice through its constructor; the bot reads
// its own table; nothing else hardcodes a number.
import type { EngineBalance } from '../engine/types';
import type { BotDifficulty } from './types';

export interface BotDifficultyParams {
  /** Mean time between the bot's signs and the uniform jitter around it. */
  signIntervalMs: number;
  signJitterMs: number;
  /** Idle time between jutsus. */
  thinkMinMs: number;
  thinkMaxMs: number;
  /** Probability of choosing the long jutsu, and the same when the player's buffer is empty. */
  longPreference: number;
  longPreferenceWhenPlayerIdle: number;
  /** Chance per sign of a wrong sign that resets the bot's own buffer. */
  misfireChance: number;
  /** Reads the player's trail once it has this many signs; null never reads. */
  readsAfterSigns: number | null;
  /** Chance of abandoning its sequence to counter with the advantaged element when read. */
  counterChance: number;
  /** Chance of attempting Substitution when an enemy projectile appears. */
  substitutionChance: number;
  /** Delay before any reaction. */
  reactionMs: number;
  /** Hard only: delay the final sign so its jutsu completes inside the player's flight window. */
  timesClash: boolean;
}

/** Base damage by sequence length (docs/DESIGN.md 5.4). Grows faster than sign count. */
const DAMAGE_BY_SIGN_COUNT: Readonly<Record<number, number>> = { 3: 12, 4: 18, 5: 26, 6: 36 };

export const BALANCE = {
  /** Bump when tuning changes materially; stored on every match row. */
  version: '1',

  maxHp: 100,
  roundDurationMs: 120_000,
  flightMs: 1_500,
  damageBySignCount: DAMAGE_BY_SIGN_COUNT,
  clashAdvantageMultiplier: 1.5,
  clashDisadvantageMultiplier: 0.5,
  substitutionCooldownMs: 8_000,
  substitutionWhiffTriggersCooldown: true,
  bufferResetMs: 2_500,
  ignoreRepeatedSign: true,
  elementCycle: ['fire', 'wind', 'lightning', 'earth', 'water'] as const,

  /** Input pipeline. */
  signHoldMs: 250,
  defaultConfidenceThreshold: 0.7,
  smoothingAlpha: 0.5,

  /** Battle page. */
  countdownMs: 3_000,
  resultHoldMs: 1_200,

  bot: {
    easy: {
      signIntervalMs: 950,
      signJitterMs: 200,
      thinkMinMs: 2_000,
      thinkMaxMs: 4_000,
      longPreference: 0.2,
      longPreferenceWhenPlayerIdle: 0.2,
      misfireChance: 0.1,
      readsAfterSigns: null,
      counterChance: 0,
      substitutionChance: 0.15,
      reactionMs: 800,
      timesClash: false,
    },
    medium: {
      signIntervalMs: 750,
      signJitterMs: 150,
      thinkMinMs: 1_000,
      thinkMaxMs: 2_500,
      longPreference: 0.5,
      longPreferenceWhenPlayerIdle: 0.5,
      misfireChance: 0.05,
      readsAfterSigns: 2,
      counterChance: 0.5,
      substitutionChance: 0.45,
      reactionMs: 500,
      timesClash: false,
    },
    hard: {
      signIntervalMs: 550,
      signJitterMs: 100,
      thinkMinMs: 400,
      thinkMaxMs: 1_500,
      longPreference: 0.6,
      longPreferenceWhenPlayerIdle: 0.8,
      misfireChance: 0.02,
      readsAfterSigns: 1,
      counterChance: 0.85,
      substitutionChance: 0.75,
      reactionMs: 320,
      timesClash: true,
    },
  } satisfies Record<BotDifficulty, BotDifficultyParams>,
} as const satisfies EngineBalance & Record<string, unknown>;

export type BalanceConfig = typeof BALANCE;

/** The engine-facing slice, typed loosely enough for tests to override single values. */
export const ENGINE_BALANCE: EngineBalance = BALANCE;
