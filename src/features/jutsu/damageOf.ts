import { BALANCE } from '../../content/balance.config';
import type { RosterJutsuDef } from '../../content/roster';

/** Damage for an attack of this length, from the balance config, so the book never drifts. */
export function damageOf(jutsu: RosterJutsuDef): number | null {
  if (jutsu.kind !== 'attack') return null;
  return BALANCE.damageBySignCount[jutsu.sequence.length] ?? null;
}
