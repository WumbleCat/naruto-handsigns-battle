// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../features/auth/authContext';
import type { MatchRow } from '../lib/database.types';

// A fake query builder: every method chains, awaiting resolves to the configured response.
const fake = vi.hoisted(() => {
  const state = {
    rows: [] as MatchRow[],
    fail: false,
    calls: [] as Array<Record<string, unknown>>,
  };
  function builder() {
    const spec: Record<string, unknown> = {};
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'order', 'limit', 'lt', 'eq', 'insert', 'upsert']) {
      chain[method] = (...args: unknown[]) => {
        spec[method] = args;
        return chain;
      };
    }
    chain.then = (resolve: (value: unknown) => void) => {
      state.calls.push(spec);
      if (state.fail) {
        resolve({ data: null, error: { message: 'boom' }, count: null });
        return;
      }
      const select = spec.select as unknown[] | undefined;
      const head = Boolean((select?.[1] as { head?: boolean } | undefined)?.head);
      if (head) {
        const eq = spec.eq as [string, string] | undefined;
        const count = eq ? state.rows.filter((r) => r.result === eq[1]).length : state.rows.length;
        resolve({ data: null, error: null, count });
        return;
      }
      let rows = [...state.rows];
      const eq = spec.eq as [string, string] | undefined;
      if (eq) rows = rows.filter((r) => (r as unknown as Record<string, unknown>)[eq[0]] === eq[1]);
      const lt = spec.lt as [string, string] | undefined;
      if (lt) rows = rows.filter((r) => r.created_at < lt[1]);
      const limit = (spec.limit as [number] | undefined)?.[0] ?? rows.length;
      resolve({ data: rows.slice(0, limit), error: null, count: null });
    };
    return chain;
  }
  return { state, client: { from: () => builder() } };
});

vi.mock('../lib/supabase', () => ({ supabase: fake.client }));

import { HistoryPage } from './HistoryPage';

function row(i: number, result: MatchRow['result'] = 'win'): MatchRow {
  return {
    id: `m${i}`,
    player_id: 'u1',
    opponent_type: 'bot',
    bot_difficulty: 'medium',
    opponent_id: null,
    result,
    end_reason: 'ko',
    input_mode: 'keyboard',
    duration_seconds: 40 + i,
    player_hp_left: 50,
    opponent_hp_left: 0,
    damage_dealt: 100,
    damage_taken: 50,
    jutsus_used: { fire_short: 2, water_long: 1, wind_short: 1, earth_short: 1, substitution: 1 },
    balance_version: '1',
    created_at: new Date(2026, 10, 11, 12, 0, 0, 1000 - i).toISOString(),
  };
}

const auth: AuthState = {
  status: 'signed-in',
  user: { id: 'u1', email: 'a@b.c', username: 'sakura' },
  signIn: vi.fn(() => Promise.resolve()),
  signUp: vi.fn(() => Promise.resolve({ kind: 'signed-in' as const })),
  signOut: vi.fn(() => Promise.resolve()),
  isUsernameAvailable: vi.fn(() => Promise.resolve(true)),
  updateUsername: vi.fn(() => Promise.resolve()),
};

function renderPage() {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  fake.state.rows = [];
  fake.state.fail = false;
  fake.state.calls = [];
});

describe('HistoryPage', () => {
  it('shows the empty state when there are no matches', async () => {
    renderPage();
    expect(await screen.findByText('Your first duel starts here.')).toBeInTheDocument();
  });

  it('lists matches with a summary, jutsu seals and an overflow count', async () => {
    fake.state.rows = [row(1, 'win'), row(2, 'loss'), row(3, 'win')];
    renderPage();
    expect(await screen.findByText('3 matches, 2 won.')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getAllByText('+1')).toHaveLength(3);
    expect(screen.getAllByRole('img', { name: 'Fireball' }).length).toBeGreaterThan(0);
  });

  it('loads more pages', async () => {
    fake.state.rows = Array.from({ length: 25 }, (_, i) => row(i));
    renderPage();
    await screen.findByText('25 matches, 25 won.');
    expect(screen.getAllByRole('row')).toHaveLength(21);
    await userEvent.click(screen.getByRole('button', { name: /Load 20 more/ }));
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(26));
    expect(screen.queryByRole('button', { name: /Load 20 more/ })).not.toBeInTheDocument();
  });

  it('filters by result and offers to clear an empty filter', async () => {
    fake.state.rows = [row(1, 'win'), row(2, 'win')];
    renderPage();
    await screen.findByText('2 matches, 2 won.');
    await userEvent.selectOptions(screen.getByLabelText('Result'), 'loss');
    expect(await screen.findByText('No matches match these filters.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(3));
  });

  it('shows an error with a retry', async () => {
    fake.state.fail = true;
    renderPage();
    expect(await screen.findByText("Couldn't load your matches.")).toBeInTheDocument();
    fake.state.fail = false;
    fake.state.rows = [row(1)];
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2));
  });
});
