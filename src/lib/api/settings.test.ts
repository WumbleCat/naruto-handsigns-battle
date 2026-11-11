import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings/schema';
import type { AppSupabaseClient } from '../supabase';
import { loadSettings, saveSettings, SettingsSaveError } from './settings';

function fakeClient(options: {
  row?: { settings: unknown } | null;
  error?: { message: string } | null;
}) {
  const upsert = vi.fn(() => Promise.resolve({ error: options.error ?? null }));
  const maybeSingle = vi.fn(() =>
    Promise.resolve({ data: options.row ?? null, error: options.error ?? null }),
  );
  const chain = { select: () => ({ eq: () => ({ maybeSingle }) }), upsert };
  return { client: { from: () => chain } as unknown as AppSupabaseClient, upsert, maybeSingle };
}

describe('settings api', () => {
  it('returns the stored blob or null', async () => {
    const { client: stored } = fakeClient({ row: { settings: { theme: 'light' } } });
    expect(await loadSettings(stored, 'u1')).toEqual({ theme: 'light' });
    const empty = fakeClient({ row: null });
    expect(await loadSettings(empty.client, 'u1')).toBeNull();
  });

  it('upserts on the user id', async () => {
    const { client, upsert } = fakeClient({});
    await saveSettings(client, 'u1', DEFAULT_SETTINGS);
    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'u1', settings: DEFAULT_SETTINGS },
      { onConflict: 'user_id' },
    );
  });

  it('wraps failures in SettingsSaveError', async () => {
    const { client } = fakeClient({ error: { message: 'down' } });
    await expect(saveSettings(client, 'u1', DEFAULT_SETTINGS)).rejects.toBeInstanceOf(
      SettingsSaveError,
    );
    await expect(loadSettings(client, 'u1')).rejects.toBeInstanceOf(SettingsSaveError);
  });
});
