// Every tunable number in the game lives here (docs/DESIGN.md section 5.6).
// The engine receives this object through its constructor; nothing else hardcodes a number.
// Milestone v0.2.0 completes it (damage table, multipliers, bot parameters).

export const BALANCE = {
  maxHp: 100,
  roundDurationMs: 120_000,
  flightMs: 1_500,
  substitutionCooldownMs: 8_000,
  signHoldMs: 250,
  bufferResetMs: 2_500,
  countdownMs: 3_000,
  defaultConfidenceThreshold: 0.7,
} as const;

export type BalanceConfig = typeof BALANCE;
