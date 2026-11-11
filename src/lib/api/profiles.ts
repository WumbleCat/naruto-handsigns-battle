import { AuthError } from '../../features/auth/authContext';
import type { AppSupabaseClient } from '../supabase';

const UNIQUE_VIOLATION = '23505';

export interface Profile {
  id: string;
  username: string;
}

/** The signed-in player's own profile (RLS hides everyone else's). Null when missing. */
export async function fetchProfile(
  client: AppSupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('id, username')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new AuthError('unknown', error.message);
  return data;
}

/** Security-definer RPC, so it works before sign-up without exposing other profiles. */
export async function isUsernameAvailable(
  client: AppSupabaseClient,
  username: string,
): Promise<boolean> {
  const { data, error } = await client.rpc('is_username_available', {
    candidate: username.toLowerCase(),
  });
  if (error) throw new AuthError('unknown', error.message);
  return data === true;
}

export async function updateUsername(
  client: AppSupabaseClient,
  userId: string,
  username: string,
): Promise<void> {
  const { error } = await client
    .from('profiles')
    .update({ username: username.toLowerCase() })
    .eq('id', userId);
  if (error) {
    if (error.code === UNIQUE_VIOLATION)
      throw new AuthError('username-taken', 'That username is taken.');
    throw new AuthError('unknown', error.message);
  }
}
