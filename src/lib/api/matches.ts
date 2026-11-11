// Match persistence (docs/DESIGN.md 9.1). One row per completed match, written by the player.
import type { BattleOutcome, BattleSetup } from '../../features/battle/battleSessionContext';
import type { MatchInsert, MatchRow } from '../database.types';
import type { AppSupabaseClient } from '../supabase';

export class MatchSaveError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'MatchSaveError';
  }
}

/** Builds the row for a finished bot match. */
export function toMatchInsert(
  outcome: BattleOutcome,
  setup: BattleSetup,
  playerId: string,
  balanceVersion: string,
): MatchInsert {
  return {
    player_id: playerId,
    opponent_type: 'bot',
    bot_difficulty: setup.difficulty,
    result: outcome.result,
    end_reason: outcome.endReason,
    input_mode: setup.inputMode,
    duration_seconds: outcome.durationSeconds,
    player_hp_left: outcome.playerHpLeft,
    opponent_hp_left: outcome.opponentHpLeft,
    damage_dealt: outcome.damageDealt,
    damage_taken: outcome.damageTaken,
    jutsus_used: outcome.jutsusUsed,
    balance_version: balanceVersion,
  };
}

export async function saveMatch(client: AppSupabaseClient, row: MatchInsert): Promise<void> {
  const { error } = await client.from('matches').insert(row);
  if (error) throw new MatchSaveError(error.message, { cause: error });
}

export interface MatchPage {
  rows: MatchRow[];
  /** True when another page exists. */
  hasMore: boolean;
}

export interface MatchCounts {
  total: number;
  wins: number;
}

/** Totals for the summary line, without fetching rows. */
export async function countMatches(client: AppSupabaseClient): Promise<MatchCounts> {
  const total = await client.from('matches').select('id', { count: 'exact', head: true });
  if (total.error) throw new MatchSaveError(total.error.message, { cause: total.error });
  const wins = await client
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('result', 'win');
  if (wins.error) throw new MatchSaveError(wins.error.message, { cause: wins.error });
  return { total: total.count ?? 0, wins: wins.count ?? 0 };
}

export interface ListMatchesOptions {
  limit?: number;
  /** Fetch rows created before this ISO timestamp (cursor). */
  before?: string;
  result?: MatchRow['result'];
  difficulty?: NonNullable<MatchRow['bot_difficulty']>;
}

/** The signed-in player's matches, newest first. RLS limits rows to the caller's own. */
export async function listMatches(
  client: AppSupabaseClient,
  options: ListMatchesOptions = {},
): Promise<MatchPage> {
  const limit = options.limit ?? 20;
  let query = client
    .from('matches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit + 1);
  if (options.before) query = query.lt('created_at', options.before);
  if (options.result) query = query.eq('result', options.result);
  if (options.difficulty) query = query.eq('bot_difficulty', options.difficulty);
  const { data, error } = await query;
  if (error) throw new MatchSaveError(error.message, { cause: error });
  const rows = data ?? [];
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
}
