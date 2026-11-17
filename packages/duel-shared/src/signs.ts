import type { DuelSign } from './types.ts';

/** Display names for the seven duel signs. */
export const SIGN_LABELS: Readonly<Record<DuelSign, string>> = {
  tiger: 'Tiger',
  boar: 'Boar',
  horse: 'Horse',
  rat: 'Rat',
  bird: 'Bird',
  snake: 'Snake',
  ram: 'Ram',
};

/** Mock hand signs by KeyboardEvent.code, as the spec prescribes (Q E R T Y U I). */
export const MOCK_SIGN_KEYS: Readonly<Record<string, DuelSign>> = {
  KeyQ: 'tiger',
  KeyE: 'boar',
  KeyR: 'horse',
  KeyT: 'rat',
  KeyY: 'bird',
  KeyU: 'snake',
  KeyI: 'ram',
};

/** The key that mocks a sign, for the on-screen labels. */
export const MOCK_KEY_FOR_SIGN: Readonly<Record<DuelSign, string>> = {
  tiger: 'Q',
  boar: 'E',
  horse: 'R',
  rat: 'T',
  bird: 'Y',
  snake: 'U',
  ram: 'I',
};
