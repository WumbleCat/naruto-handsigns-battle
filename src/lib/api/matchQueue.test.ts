// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchInsert } from '../database.types';
import type { AppSupabaseClient } from '../supabase';
import { enqueueMatch, flushMatchQueue, MATCH_QUEUE_KEY, readMatchQueue } from './matchQueue';

function row(playerId: string, result: MatchInsert['result'] = 'win'): MatchInsert {
  return {
    player_id: playerId,
    opponent_type: 'bot',
    bot_difficulty: 'easy',
    result,
    end_reason: 'ko',
    input_mode: 'keyboard',
    duration_seconds: 10,
    player_hp_left: 50,
    opponent_hp_left: 0,
    damage_dealt: 100,
    damage_taken: 50,
    jutsus_used: { fire_short: 2 },
    balance_version: '1',
  };
}

function client(failOn: (row: MatchInsert) => boolean) {
  const insert = vi.fn((value: MatchInsert) =>
    Promise.resolve({ error: failOn(value) ? { message: 'nope' } : null }),
  );
  return { client: { from: () => ({ insert }) } as unknown as AppSupabaseClient, insert };
}

beforeEach(() => {
  localStorage.clear();
});

describe('match queue', () => {
  it('starts empty and survives garbage in storage', () => {
    expect(readMatchQueue()).toEqual([]);
    localStorage.setItem(MATCH_QUEUE_KEY, '{not json');
    expect(readMatchQueue()).toEqual([]);
    localStorage.setItem(MATCH_QUEUE_KEY, JSON.stringify([{ player_id: 1 }]));
    expect(readMatchQueue()).toEqual([]);
  });

  it('enqueues rows in order', () => {
    enqueueMatch(row('u1', 'win'));
    enqueueMatch(row('u1', 'loss'));
    expect(readMatchQueue().map((r) => r.result)).toEqual(['win', 'loss']);
  });

  it('flushes the current player rows and keeps the rest', async () => {
    enqueueMatch(row('u1'));
    enqueueMatch(row('u2'));
    enqueueMatch(row('u1', 'draw'));
    const { client: c, insert } = client(() => false);
    const saved = await flushMatchQueue(c, 'u1');
    expect(saved).toBe(2);
    expect(insert).toHaveBeenCalledTimes(2);
    expect(readMatchQueue().map((r) => r.player_id)).toEqual(['u2']);
  });

  it('keeps rows that fail to save', async () => {
    enqueueMatch(row('u1', 'win'));
    enqueueMatch(row('u1', 'loss'));
    const { client: c } = client((r) => r.result === 'loss');
    const saved = await flushMatchQueue(c, 'u1');
    expect(saved).toBe(1);
    expect(readMatchQueue().map((r) => r.result)).toEqual(['loss']);
  });
});
