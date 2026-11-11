import { describe, expect, it } from 'vitest';
import { ELEMENTS } from '../engine/types';
import { BALANCE } from './balance.config';
import { JUTSU_IDS, ROSTER, ROSTER_BY_ID } from './roster';

function isPrefix(short: readonly string[], long: readonly string[]): boolean {
  return short.length <= long.length && short.every((sign, i) => sign === long[i]);
}

describe('roster invariants (docs/DESIGN.md 6.1)', () => {
  it('has eleven jutsus with unique ids matching JUTSU_IDS', () => {
    expect(ROSTER).toHaveLength(11);
    expect(new Set(ROSTER.map((j) => j.id)).size).toBe(11);
    expect(ROSTER.map((j) => j.id).sort()).toEqual([...JUTSU_IDS].sort());
  });

  it('is prefix-free: no sequence is a prefix of another', () => {
    for (const a of ROSTER) {
      for (const b of ROSTER) {
        if (a.id === b.id) continue;
        expect(isPrefix(a.sequence, b.sequence), `${a.id} is a prefix of ${b.id}`).toBe(false);
      }
    }
  });

  it('never repeats a sign within a sequence', () => {
    for (const jutsu of ROSTER) {
      expect(new Set(jutsu.sequence).size, jutsu.id).toBe(jutsu.sequence.length);
    }
  });

  it('gives each element one unique opener shared by its two jutsus', () => {
    const openerByElement = new Map<string, string>();
    for (const jutsu of ROSTER) {
      const key = jutsu.element ?? 'substitution';
      const opener = jutsu.sequence[0];
      expect(opener).toBeDefined();
      if (!opener) continue;
      const existing = openerByElement.get(key);
      if (existing) expect(opener).toBe(existing);
      else openerByElement.set(key, opener);
    }
    expect(new Set(openerByElement.values()).size).toBe(ELEMENTS.length + 1);
  });

  it('keeps opener signs out of later positions', () => {
    const openers = new Set(ROSTER.map((j) => j.sequence[0]));
    for (const jutsu of ROSTER) {
      for (const sign of jutsu.sequence.slice(1)) {
        expect(openers.has(sign), `${jutsu.id} reuses opener ${sign}`).toBe(false);
      }
    }
  });

  it('gives every element one short (3 or 4) and one long (5 or 6) attack', () => {
    for (const element of ELEMENTS) {
      const lengths = ROSTER.filter((j) => j.element === element)
        .map((j) => j.sequence.length)
        .sort((a, b) => a - b);
      expect(lengths).toHaveLength(2);
      expect([3, 4]).toContain(lengths[0]);
      expect([5, 6]).toContain(lengths[1]);
    }
  });

  it('covers every attack length in the damage table', () => {
    for (const jutsu of ROSTER) {
      if (jutsu.kind !== 'attack') continue;
      expect(BALANCE.damageBySignCount[jutsu.sequence.length], jutsu.id).toBeGreaterThan(0);
    }
  });

  it('makes Substitution a two-sign jutsu with no element', () => {
    expect(ROSTER_BY_ID.substitution.sequence).toHaveLength(2);
    expect(ROSTER_BY_ID.substitution.element).toBeNull();
  });
});
