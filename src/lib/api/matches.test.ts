import { describe, expect, it, vi } from 'vitest';
import type { BattleOutcome } from '../../features/battle/battleSessionContext';
import type { AppSupabaseClient } from '../supabase';
import { MatchSaveError, saveMatch, toMatchInsert } from './matches';

const OUTCOME: BattleOutcome = {
  result: 'win',
  endReason: 'ko',
  durationSeconds: 48,
  playerHpLeft: 36,
  opponentHpLeft: 0,
  damageDealt: 118,
  damageTaken: 64,
  clashesWon: 2,
  clashesLost: 1,
  substitutions: 1,
  jutsusUsed: { fire_short: 3, water_long: 1, substitution: 1 },
};

describe('toMatchInsert', () => {
  it('maps an outcome and setup to the matches row', () => {
    const row = toMatchInsert(OUTCOME, { difficulty: 'medium', inputMode: 'keyboard' }, 'u1', '1');
    expect(row).toEqual({
      player_id: 'u1',
      opponent_type: 'bot',
      bot_difficulty: 'medium',
      result: 'win',
      end_reason: 'ko',
      input_mode: 'keyboard',
      duration_seconds: 48,
      player_hp_left: 36,
      opponent_hp_left: 0,
      damage_dealt: 118,
      damage_taken: 64,
      jutsus_used: { fire_short: 3, water_long: 1, substitution: 1 },
      balance_version: '1',
    });
  });
});

describe('saveMatch', () => {
  function clientWith(error: { message: string } | null) {
    const insert = vi.fn(() => Promise.resolve({ error }));
    const from = vi.fn(() => ({ insert }));
    return { client: { from } as unknown as AppSupabaseClient, insert, from };
  }

  it('inserts into matches', async () => {
    const { client, from, insert } = clientWith(null);
    const row = toMatchInsert(OUTCOME, { difficulty: 'easy', inputMode: 'webcam' }, 'u1', '1');
    await saveMatch(client, row);
    expect(from).toHaveBeenCalledWith('matches');
    expect(insert).toHaveBeenCalledWith(row);
  });

  it('throws a MatchSaveError on failure', async () => {
    const { client } = clientWith({ message: 'RLS says no' });
    const row = toMatchInsert(OUTCOME, { difficulty: 'easy', inputMode: 'webcam' }, 'u1', '1');
    await expect(saveMatch(client, row)).rejects.toBeInstanceOf(MatchSaveError);
  });
});
