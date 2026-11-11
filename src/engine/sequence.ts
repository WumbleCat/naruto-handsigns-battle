import type { EngineBalance, JutsuDef, SignId } from './types';

export type SequenceMatch =
  | { status: 'complete'; jutsu: JutsuDef }
  | { status: 'prefix'; candidates: readonly JutsuDef[] }
  | { status: 'none' };

/** Matches a sign buffer against the roster. Pure; safe to share between engine and UI. */
export class SequenceMatcher {
  private readonly roster: readonly JutsuDef[];

  constructor(roster: readonly JutsuDef[]) {
    this.roster = roster;
  }

  match(buffer: readonly SignId[]): SequenceMatch {
    if (buffer.length === 0) return { status: 'prefix', candidates: this.roster };
    const candidates = this.roster.filter(
      (jutsu) =>
        jutsu.sequence.length >= buffer.length &&
        buffer.every((sign, index) => jutsu.sequence[index] === sign),
    );
    const complete = candidates.find((jutsu) => jutsu.sequence.length === buffer.length);
    if (complete) return { status: 'complete', jutsu: complete };
    if (candidates.length > 0) return { status: 'prefix', candidates };
    return { status: 'none' };
  }

  /** True when `sign` can start some sequence. */
  isOpener(sign: SignId): boolean {
    return this.roster.some((jutsu) => jutsu.sequence[0] === sign);
  }
}

function isPrefix(short: readonly SignId[], long: readonly SignId[]): boolean {
  return short.length <= long.length && short.every((sign, index) => sign === long[index]);
}

/** Returns a list of problems; empty means the roster is playable under this balance. */
export function validateRoster(roster: readonly JutsuDef[], balance: EngineBalance): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();

  for (const jutsu of roster) {
    if (ids.has(jutsu.id)) problems.push(`duplicate jutsu id "${jutsu.id}"`);
    ids.add(jutsu.id);

    if (jutsu.sequence.length === 0) problems.push(`"${jutsu.id}" has an empty sequence`);

    for (let i = 1; i < jutsu.sequence.length; i += 1) {
      if (jutsu.sequence[i] === jutsu.sequence[i - 1]) {
        problems.push(`"${jutsu.id}" repeats "${jutsu.sequence[i]}" consecutively`);
      }
    }

    if (jutsu.kind === 'attack' && !(jutsu.sequence.length in balance.damageBySignCount)) {
      problems.push(
        `"${jutsu.id}" has ${jutsu.sequence.length} signs but the damage table has no entry for that length`,
      );
    }
  }

  for (const a of roster) {
    for (const b of roster) {
      if (a.id !== b.id && isPrefix(a.sequence, b.sequence)) {
        problems.push(`"${a.id}" is a prefix of "${b.id}"`);
      }
    }
  }

  return problems;
}
