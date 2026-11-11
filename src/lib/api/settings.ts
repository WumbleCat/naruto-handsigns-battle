// user_settings persistence (docs/DESIGN.md 9.4): one jsonb blob per user.
import type { Settings } from '../settings/schema';
import type { AppSupabaseClient } from '../supabase';

export class SettingsSaveError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SettingsSaveError';
  }
}

/** The stored blob, unvalidated; the caller runs it through parseSettings. Null when none. */
export async function loadSettings(client: AppSupabaseClient, userId: string): Promise<unknown> {
  const { data, error } = await client
    .from('user_settings')
    .select('settings')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new SettingsSaveError(error.message, { cause: error });
  return data?.settings ?? null;
}

export async function saveSettings(
  client: AppSupabaseClient,
  userId: string,
  settings: Settings,
): Promise<void> {
  const { error } = await client
    .from('user_settings')
    .upsert({ user_id: userId, settings }, { onConflict: 'user_id' });
  if (error) throw new SettingsSaveError(error.message, { cause: error });
}
