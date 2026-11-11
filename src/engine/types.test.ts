import { describe, expect, it } from 'vitest';
import { ELEMENTS, isElement, isSignId, SIGN_IDS } from './types';

describe('engine identifiers', () => {
  it('defines the twelve zodiac signs exactly once each', () => {
    expect(SIGN_IDS).toHaveLength(12);
    expect(new Set(SIGN_IDS).size).toBe(12);
  });

  it('defines five elements in cycle order', () => {
    expect(ELEMENTS).toEqual(['fire', 'wind', 'lightning', 'earth', 'water']);
  });

  it('narrows unknown values', () => {
    expect(isSignId('tiger')).toBe(true);
    expect(isSignId('phoenix')).toBe(false);
    expect(isSignId(3)).toBe(false);
    expect(isElement('water')).toBe(true);
    expect(isElement('ice')).toBe(false);
  });
});
