import { describe, expect, it } from 'vitest';
import { advantage, beats, counterOf } from './elements';
import { ELEMENTS, type Element } from './types';

const CYCLE = ELEMENTS;

describe('element cycle', () => {
  it('follows fire > wind > lightning > earth > water > fire', () => {
    expect(beats(CYCLE, 'fire', 'wind')).toBe(true);
    expect(beats(CYCLE, 'wind', 'lightning')).toBe(true);
    expect(beats(CYCLE, 'lightning', 'earth')).toBe(true);
    expect(beats(CYCLE, 'earth', 'water')).toBe(true);
    expect(beats(CYCLE, 'water', 'fire')).toBe(true);
  });

  it('is never symmetric', () => {
    for (const a of CYCLE) {
      for (const b of CYCLE) {
        if (beats(CYCLE, a, b)) expect(beats(CYCLE, b, a)).toBe(false);
      }
    }
  });

  it('classifies every ordered pair exactly once as advantaged, disadvantaged or neutral', () => {
    const counts = { advantaged: 0, disadvantaged: 0, neutral: 0 };
    for (const a of CYCLE) {
      for (const b of CYCLE) {
        counts[advantage(CYCLE, a, b)] += 1;
      }
    }
    expect(counts).toEqual({ advantaged: 5, disadvantaged: 5, neutral: 15 });
  });

  it('treats the same element as neutral', () => {
    for (const element of CYCLE) {
      expect(advantage(CYCLE, element, element)).toBe('neutral');
    }
  });

  it('names the counter of each element', () => {
    const expected: Record<Element, Element> = {
      fire: 'water',
      wind: 'fire',
      lightning: 'wind',
      earth: 'lightning',
      water: 'earth',
    };
    for (const element of CYCLE) {
      expect(counterOf(CYCLE, element)).toBe(expected[element]);
      expect(beats(CYCLE, counterOf(CYCLE, element), element)).toBe(true);
    }
  });
});
