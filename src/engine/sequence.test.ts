import { describe, expect, it } from 'vitest';
import { ENGINE_BALANCE } from '../content/balance.config';
import { ROSTER } from '../content/roster';
import { SequenceMatcher, validateRoster } from './sequence';
import type { JutsuDef } from './types';

describe('SequenceMatcher', () => {
  const matcher = new SequenceMatcher(ROSTER);

  it('reports a prefix with the jutsus it could become', () => {
    const result = matcher.match(['tiger']);
    expect(result.status).toBe('prefix');
    if (result.status === 'prefix') {
      expect(result.candidates.map((j) => j.id).sort()).toEqual(['fire_long', 'fire_short']);
    }
  });

  it('reports completion for a full sequence', () => {
    const result = matcher.match(['tiger', 'horse', 'rat']);
    expect(result).toMatchObject({ status: 'complete', jutsu: { id: 'fire_short' } });
  });

  it('reports none for a buffer that matches nothing', () => {
    expect(matcher.match(['tiger', 'snake'])).toEqual({ status: 'none' });
    expect(matcher.match(['rat'])).toEqual({ status: 'none' });
  });

  it('treats the empty buffer as a prefix of everything', () => {
    const result = matcher.match([]);
    expect(result.status).toBe('prefix');
    if (result.status === 'prefix') expect(result.candidates).toHaveLength(ROSTER.length);
  });

  it('knows which signs open a sequence', () => {
    expect(matcher.isOpener('tiger')).toBe(true);
    expect(matcher.isOpener('ram')).toBe(true);
    expect(matcher.isOpener('rat')).toBe(false);
  });
});

describe('validateRoster', () => {
  it('accepts the shipped roster', () => {
    expect(validateRoster(ROSTER, ENGINE_BALANCE)).toEqual([]);
  });

  it('rejects a sequence that is a prefix of another', () => {
    const roster: JutsuDef[] = [
      { id: 'a', kind: 'attack', element: 'fire', sequence: ['tiger', 'horse', 'rat'] },
      { id: 'b', kind: 'attack', element: 'fire', sequence: ['tiger', 'horse', 'rat', 'dog'] },
    ];
    expect(validateRoster(roster, ENGINE_BALANCE).join('\n')).toContain('"a" is a prefix of "b"');
  });

  it('rejects consecutive repeats, unknown lengths and duplicate ids', () => {
    const roster: JutsuDef[] = [
      { id: 'a', kind: 'attack', element: 'fire', sequence: ['tiger', 'tiger', 'rat'] },
      { id: 'a', kind: 'attack', element: 'wind', sequence: ['bird', 'rat'] },
    ];
    const problems = validateRoster(roster, ENGINE_BALANCE).join('\n');
    expect(problems).toContain('repeats "tiger"');
    expect(problems).toContain('damage table has no entry');
    expect(problems).toContain('duplicate jutsu id');
  });
});
