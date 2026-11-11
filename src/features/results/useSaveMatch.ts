import { useEffect, useState } from 'react';
import { BALANCE } from '../../content/balance.config';
import { enqueueMatch } from '../../lib/api/matchQueue';
import { saveMatch, toMatchInsert } from '../../lib/api/matches';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/authContext';
import type { BattleOutcome, BattleSetup } from '../battle/battleSessionContext';

export type SaveStatus = 'saving' | 'saved' | 'queued' | 'unavailable';

/**
 * Saves a finished match once. On failure the row is queued and retried on the next app load.
 * "unavailable" covers the dev user and builds without Supabase.
 */
export function useSaveMatch(outcome: BattleOutcome | null, setup: BattleSetup | null): SaveStatus {
  const { user } = useAuth();
  const canSave = Boolean(supabase && user && outcome && setup && user.id !== 'dev-user');
  const [status, setStatus] = useState<SaveStatus>(canSave ? 'saving' : 'unavailable');

  useEffect(() => {
    if (!supabase || !user || !outcome || !setup || user.id === 'dev-user') return;
    const row = toMatchInsert(outcome, setup, user.id, BALANCE.version);
    let cancelled = false;
    saveMatch(supabase, row)
      .then(() => {
        if (!cancelled) setStatus('saved');
      })
      .catch(() => {
        enqueueMatch(row);
        if (!cancelled) setStatus('queued');
      });
    return () => {
      cancelled = true;
    };
    // The outcome object identity is stable for one results page visit.
  }, [outcome, setup, user]);

  return status;
}
