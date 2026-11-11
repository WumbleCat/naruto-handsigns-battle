// Match History (docs/FRONTEND_DESIGN.md 6.9): a summary sentence, two filters, the table.
import { useMemo, useState } from 'react';
import { Banner } from '../components/Banner/Banner';
import { Button } from '../components/Button/Button';
import { LinkButton } from '../components/Button/LinkButton';
import { PageShell } from '../components/PageShell/PageShell';
import { Seal } from '../components/Seal/Seal';
import { Select } from '../components/Select/Select';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { EmptyState } from '../components/StateBlock/StateBlock';
import { CONTENT } from '../content/content.config';
import { isRosterJutsuId, ROSTER_BY_ID } from '../content/roster';
import { formatClock } from '../features/battle/hud/formatClock';
import {
  PAGE_SIZE,
  useMatchHistory,
  type HistoryFilters,
} from '../features/history/useMatchHistory';
import type { MatchRow } from '../lib/database.types';
import styles from './HistoryPage.module.css';

const RESULT_OPTIONS = [
  { value: 'all', label: 'All results' },
  { value: 'win', label: 'Wins' },
  { value: 'loss', label: 'Losses' },
  { value: 'draw', label: 'Draws' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'all', label: 'All difficulties' },
  { value: 'easy', label: CONTENT.difficulties.easy.name },
  { value: 'medium', label: CONTENT.difficulties.medium.name },
  { value: 'hard', label: CONTENT.difficulties.hard.name },
];

const SHOWN_JUTSUS = 4;

function resultWord(result: MatchRow['result']): string {
  return result === 'win' ? 'Won' : result === 'loss' ? 'Lost' : 'Draw';
}

function opponentName(row: MatchRow): string {
  if (row.opponent_type === 'bot' && row.bot_difficulty) {
    return `${CONTENT.bot.name} (${CONTENT.difficulties[row.bot_difficulty].name})`;
  }
  return 'Player';
}

function jutsuCounts(row: MatchRow): Array<[string, number]> {
  const used = row.jutsus_used;
  if (!used || typeof used !== 'object' || Array.isArray(used)) return [];
  return Object.entries(used)
    .filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' && isRosterJutsuId(entry[0]),
    )
    .sort((a, b) => b[1] - a[1]);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoryPage() {
  const [filters, setFilters] = useState<HistoryFilters>({ result: 'all', difficulty: 'all' });
  const memoFilters = useMemo(() => filters, [filters]);
  const { state, loadMore, retry } = useMatchHistory(memoFilters);
  const filtered = filters.result !== 'all' || filters.difficulty !== 'all';

  return (
    <PageShell wide>
      <h1 className="t-display-md">Match History</h1>

      {state.status === 'ready' && state.counts ? (
        <p className="t-lead t-secondary">
          {state.counts.total === 0
            ? 'No matches yet.'
            : `${state.counts.total} ${state.counts.total === 1 ? 'match' : 'matches'}, ${state.counts.wins} won.`}
        </p>
      ) : null}

      {state.status !== 'unavailable' ? (
        <div className={styles.filters}>
          <Select
            label="Result"
            options={RESULT_OPTIONS}
            value={filters.result}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                result: event.target.value as HistoryFilters['result'],
              }))
            }
          />
          <Select
            label="Difficulty"
            options={DIFFICULTY_OPTIONS}
            value={filters.difficulty}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                difficulty: event.target.value as HistoryFilters['difficulty'],
              }))
            }
          />
        </div>
      ) : null}

      {state.status === 'unavailable' ? (
        <EmptyState
          title="Match history needs an account."
          action={
            <LinkButton to="/play" variant="primary">
              Play vs Bot
            </LinkButton>
          }
        >
          Matches played as the dev user, or without Supabase configured, are not saved.
        </EmptyState>
      ) : null}

      {state.status === 'loading' ? (
        <div className={styles.skeleton} aria-busy="true" aria-label="Loading matches">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} height={44} />
          ))}
        </div>
      ) : null}

      {state.status === 'error' ? (
        <Banner tone="danger" action={<Button onClick={retry}>Try again</Button>}>
          Couldn't load your matches.
        </Banner>
      ) : null}

      {state.status === 'ready' && state.rows.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No matches match these filters."
            action={
              <Button onClick={() => setFilters({ result: 'all', difficulty: 'all' })}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No matches yet."
            action={
              <LinkButton to="/play" variant="primary">
                Play vs Bot
              </LinkButton>
            }
          >
            Your first duel starts here.
          </EmptyState>
        )
      ) : null}

      {state.status === 'ready' && state.rows.length > 0 ? (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Opponent</th>
                  <th scope="col">Result</th>
                  <th scope="col">Duration</th>
                  <th scope="col">HP left</th>
                  <th scope="col">Jutsu</th>
                </tr>
              </thead>
              <tbody>
                {state.rows.map((row) => {
                  const jutsus = jutsuCounts(row);
                  const extra = jutsus.length - SHOWN_JUTSUS;
                  return (
                    <tr key={row.id}>
                      <td>{formatDate(row.created_at)}</td>
                      <td>{opponentName(row)}</td>
                      <td className={styles.result} data-result={row.result}>
                        {resultWord(row.result)}
                        {row.end_reason !== 'ko' ? (
                          <span className={styles.reason}>
                            {' '}
                            {row.end_reason === 'timeout' ? 'on time' : 'by forfeit'}
                          </span>
                        ) : null}
                      </td>
                      <td className={styles.number}>{formatClock(row.duration_seconds * 1000)}</td>
                      <td className={styles.number}>
                        {row.player_hp_left} to {row.opponent_hp_left}
                      </td>
                      <td>
                        <span className={styles.jutsus}>
                          {jutsus.slice(0, SHOWN_JUTSUS).map(([id, count]) => {
                            if (!isRosterJutsuId(id)) return null;
                            const jutsu = ROSTER_BY_ID[id];
                            return (
                              <span
                                key={id}
                                className={styles.jutsu}
                                title={CONTENT.jutsus[id].name}
                              >
                                <Seal
                                  element={jutsu.element ?? 'substitution'}
                                  size={24}
                                  label={CONTENT.jutsus[id].name}
                                />
                                <span className={styles.count}>×{count}</span>
                              </span>
                            );
                          })}
                          {extra > 0 ? <span className={styles.more}>+{extra}</span> : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {state.hasMore ? (
            <div>
              <Button onClick={loadMore} loading={state.loadingMore}>
                Load {PAGE_SIZE} more
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </PageShell>
  );
}
