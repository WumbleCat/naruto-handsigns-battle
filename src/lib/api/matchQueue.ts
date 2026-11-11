// A failed match save is queued in localStorage and retried on the next app load, so a flaky
// connection at the end of a match never loses history (docs/DESIGN.md 8.8).
import { z } from 'zod';
import type { MatchInsert } from '../database.types';
import type { AppSupabaseClient } from '../supabase';
import { saveMatch } from './matches';

export const MATCH_QUEUE_KEY = 'jutsu-duel.match-queue';

const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ]),
);

const queuedMatchSchema = z.object({
  player_id: z.string(),
  opponent_type: z.enum(['bot', 'human']),
  bot_difficulty: z.enum(['easy', 'medium', 'hard']).nullable().optional(),
  opponent_id: z.string().nullable().optional(),
  result: z.enum(['win', 'loss', 'draw']),
  end_reason: z.enum(['ko', 'timeout', 'forfeit']),
  input_mode: z.enum(['webcam', 'keyboard']),
  duration_seconds: z.number(),
  player_hp_left: z.number(),
  opponent_hp_left: z.number(),
  damage_dealt: z.number().optional(),
  damage_taken: z.number().optional(),
  jutsus_used: jsonValue.optional(),
  balance_version: z.string().optional(),
});

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readMatchQueue(): MatchInsert[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(MATCH_QUEUE_KEY);
    if (!raw) return [];
    const parsed = z.array(queuedMatchSchema).safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as MatchInsert[]) : [];
  } catch {
    return [];
  }
}

function writeMatchQueue(rows: MatchInsert[]): void {
  const store = storage();
  if (!store) return;
  try {
    if (rows.length === 0) store.removeItem(MATCH_QUEUE_KEY);
    else store.setItem(MATCH_QUEUE_KEY, JSON.stringify(rows));
  } catch {
    // Storage full or blocked: the match is lost, which the UI already reported.
  }
}

export function enqueueMatch(row: MatchInsert): void {
  writeMatchQueue([...readMatchQueue(), row]);
}

/** Saves queued rows for `playerId` in order; stops at the first failure and keeps the rest. */
export async function flushMatchQueue(
  client: AppSupabaseClient,
  playerId: string,
): Promise<number> {
  const queue = readMatchQueue();
  let saved = 0;
  const remaining: MatchInsert[] = [];
  for (const row of queue) {
    if (row.player_id !== playerId) {
      remaining.push(row);
      continue;
    }
    try {
      await saveMatch(client, row);
      saved += 1;
    } catch {
      remaining.push(row);
    }
  }
  writeMatchQueue(remaining);
  return saved;
}
