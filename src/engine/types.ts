// Shared identifiers for the battle engine. Pure data: no React, no DOM.
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
