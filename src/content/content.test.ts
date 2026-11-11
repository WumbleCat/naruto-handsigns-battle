import { describe, expect, it } from 'vitest';
import { ELEMENTS, SIGN_IDS } from '../engine/types';
import { CONTENT } from './content.config';
import { BOT_DIFFICULTIES } from './types';

describe('content config', () => {
  it('names every sign and gives it a pose description', () => {
    for (const id of SIGN_IDS) {
      expect(CONTENT.signs[id].name.length).toBeGreaterThan(0);
      expect(CONTENT.signs[id].pose.length).toBeGreaterThan(20);
    }
  });

  it('names every element plus substitution', () => {
    for (const id of [...ELEMENTS, 'substitution'] as const) {
      expect(CONTENT.elements[id].name.length).toBeGreaterThan(0);
    }
  });

  it('names every bot difficulty', () => {
    for (const id of BOT_DIFFICULTIES) {
      expect(CONTENT.difficulties[id].name.length).toBeGreaterThan(0);
    }
  });

  it('keeps sign names unique so trails are unambiguous', () => {
    const names = SIGN_IDS.map((id) => CONTENT.signs[id].name);
    expect(new Set(names).size).toBe(names.length);
  });
});
