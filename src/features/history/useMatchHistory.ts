import { useCallback, useEffect, useState } from 'react';
import {
  countMatches,
  listMatches,
  type ListMatchesOptions,
  type MatchCounts,
} from '../../lib/api/matches';
import type { MatchRow } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/authContext';

export interface HistoryFilters {
  result: ListMatchesOptions['result'] | 'all';
  difficulty: ListMatchesOptions['difficulty'] | 'all';
}

export type HistoryState =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      rows: MatchRow[];
      hasMore: boolean;
      loadingMore: boolean;
      counts: MatchCounts | null;
    };

export const PAGE_SIZE = 20;

function toOptions(filters: HistoryFilters, before?: string): ListMatchesOptions {
  return {
    limit: PAGE_SIZE,
    ...(before ? { before } : {}),
    ...(filters.result !== 'all' ? { result: filters.result } : {}),
    ...(filters.difficulty !== 'all' ? { difficulty: filters.difficulty } : {}),
  };
}

/** Loads the signed-in player's matches page by page with the current filters. */
export function useMatchHistory(filters: HistoryFilters): {
  state: HistoryState;
  loadMore: () => void;
  retry: () => void;
} {
  const { user } = useAuth();
  const available = Boolean(supabase && user && user.id !== 'dev-user');
  const [state, setState] = useState<HistoryState>(
    available ? { status: 'loading' } : { status: 'unavailable' },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const client = supabase;
    if (!client || !available) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setState({ status: 'loading' });
    });
    Promise.all([listMatches(client, toOptions(filters)), countMatches(client).catch(() => null)])
      .then(([page, counts]) => {
        if (cancelled) return;
        setState({
          status: 'ready',
          rows: page.rows,
          hasMore: page.hasMore,
          loadingMore: false,
          counts,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [available, filters, attempt]);

  const loadMore = useCallback(() => {
    const client = supabase;
    if (!client || state.status !== 'ready' || !state.hasMore || state.loadingMore) return;
    const last = state.rows[state.rows.length - 1];
    if (!last) return;
    setState({ ...state, loadingMore: true });
    listMatches(client, toOptions(filters, last.created_at))
      .then((page) => {
        setState((current) =>
          current.status === 'ready'
            ? {
                ...current,
                rows: [...current.rows, ...page.rows],
                hasMore: page.hasMore,
                loadingMore: false,
              }
            : current,
        );
      })
      .catch(() => {
        setState((current) =>
          current.status === 'ready' ? { ...current, loadingMore: false } : current,
        );
      });
  }, [state, filters]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, loadMore, retry };
}
