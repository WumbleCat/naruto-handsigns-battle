// Shared identifiers and data shapes for the battle engine. Pure data: no React, no DOM.
// Themed display names for these IDs live in src/content/content.config.ts.

export const SIGN_IDS = [
  'rat',
  'ox',
  'tiger',
  'hare',
  'dragon',
  'snake',
  'horse',
  'ram',
  'monkey',
  'bird',
  'dog',
  'boar',
] as const;

export type SignId = (typeof SIGN_IDS)[number];

export const ELEMENTS = ['fire', 'wind', 'lightning', 'earth', 'water'] as const;

export type Element = (typeof ELEMENTS)[number];

export type PlayerId = 'p1' | 'p2';

export function isSignId(value: unknown): value is SignId {
  return typeof value === 'string' && (SIGN_IDS as readonly string[]).includes(value);
}

export function isElement(value: unknown): value is Element {
  return typeof value === 'string' && (ELEMENTS as readonly string[]).includes(value);
}

export function otherPlayer(player: PlayerId): PlayerId {
  return player === 'p1' ? 'p2' : 'p1';
}

/** Jutsu identifiers are strings to the engine; the roster narrows them to a literal union. */
export type JutsuId = string;

export interface AttackJutsuDef {
  id: JutsuId;
  kind: 'attack';
  element: Element;
  sequence: readonly SignId[];
}

export interface SubstitutionJutsuDef {
  id: JutsuId;
  kind: 'substitution';
  element: null;
  sequence: readonly SignId[];
}

export type JutsuDef = AttackJutsuDef | SubstitutionJutsuDef;

/** The slice of the balance config the engine depends on (docs/DESIGN.md 5.6). */
export interface EngineBalance {
  maxHp: number;
  roundDurationMs: number;
  flightMs: number;
  damageBySignCount: Readonly<Record<number, number>>;
  clashAdvantageMultiplier: number;
  clashDisadvantageMultiplier: number;
  substitutionCooldownMs: number;
  substitutionWhiffTriggersCooldown: boolean;
  bufferResetMs: number;
  ignoreRepeatedSign: boolean;
  /** Each element beats the next; the last beats the first. */
  elementCycle: readonly Element[];
}
