// The demo roster (docs/DESIGN.md section 6). Game design data, not branding: themed names
// live in content.config.ts. One unique opener sign per element, openers never reappear
// later in a sequence, no sign repeats within a sequence, prefix-free by construction.
import type { JutsuDef } from '../engine/types';

export const JUTSU_IDS = [
  'fire_short',
  'fire_long',
  'wind_short',
  'wind_long',
  'lightning_short',
  'lightning_long',
  'earth_short',
  'earth_long',
  'water_short',
  'water_long',
  'substitution',
] as const;

export type RosterJutsuId = (typeof JUTSU_IDS)[number];

export type RosterJutsuDef = JutsuDef & { id: RosterJutsuId };

export const ROSTER: readonly RosterJutsuDef[] = [
  { id: 'fire_short', kind: 'attack', element: 'fire', sequence: ['tiger', 'horse', 'rat'] },
  {
    id: 'fire_long',
    kind: 'attack',
    element: 'fire',
    sequence: ['tiger', 'boar', 'dog', 'hare', 'monkey', 'horse'],
  },
  { id: 'wind_short', kind: 'attack', element: 'wind', sequence: ['bird', 'hare', 'dog'] },
  {
    id: 'wind_long',
    kind: 'attack',
    element: 'wind',
    sequence: ['bird', 'monkey', 'rat', 'boar', 'horse'],
  },
  {
    id: 'lightning_short',
    kind: 'attack',
    element: 'lightning',
    sequence: ['dragon', 'rat', 'boar', 'monkey'],
  },
  {
    id: 'lightning_long',
    kind: 'attack',
    element: 'lightning',
    sequence: ['dragon', 'dog', 'horse', 'hare', 'rat', 'boar'],
  },
  {
    id: 'earth_short',
    kind: 'attack',
    element: 'earth',
    sequence: ['ox', 'dog', 'monkey', 'hare'],
  },
  {
    id: 'earth_long',
    kind: 'attack',
    element: 'earth',
    sequence: ['ox', 'boar', 'rat', 'horse', 'dog'],
  },
  { id: 'water_short', kind: 'attack', element: 'water', sequence: ['snake', 'monkey', 'boar'] },
  {
    id: 'water_long',
    kind: 'attack',
    element: 'water',
    sequence: ['snake', 'rat', 'hare', 'dog', 'horse', 'monkey'],
  },
  { id: 'substitution', kind: 'substitution', element: null, sequence: ['ram', 'boar'] },
];

export const ROSTER_BY_ID: Readonly<Record<RosterJutsuId, RosterJutsuDef>> = Object.fromEntries(
  ROSTER.map((jutsu) => [jutsu.id, jutsu]),
) as Record<RosterJutsuId, RosterJutsuDef>;

export function isRosterJutsuId(value: unknown): value is RosterJutsuId {
  return typeof value === 'string' && (JUTSU_IDS as readonly string[]).includes(value);
}
