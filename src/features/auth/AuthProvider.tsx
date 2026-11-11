import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchProfile, isUsernameAvailable, updateUsername } from '../../lib/api/profiles';
import { supabase, type AppSupabaseClient } from '../../lib/supabase';
import {
  AuthContext,
  AuthError,
  validateUsername,
  type AuthState,
  type AuthStatus,
  type AuthUser,
  type SignUpResult,
} from './authContext';
import { mapSupabaseAuthError } from './mapSupabaseAuthError';

const NOT_CONFIGURED_MESSAGE =
  'Accounts are not configured on this build. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.';

function requireClient(): AppSupabaseClient {
  if (!supabase) throw new AuthError('not-configured', NOT_CONFIGURED_MESSAGE);
  return supabase;
}

function toAuthUser(session: Session, username: string | null): AuthUser {
  const metadataUsername: unknown = session.user.user_metadata['username'];
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    username: username ?? (typeof metadataUsername === 'string' ? metadataUsername : null),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'signed-out');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;

    const applySession = async (session: Session | null) => {
      if (!session) {
        if (active) {
          setUser(null);
          setStatus('signed-out');
        }
        return;
      }
      const profile = await fetchProfile(client, session.user.id).catch(() => null);
      if (!active) return;
      setUser(toAuthUser(session, profile?.username ?? null));
      setStatus('signed-in');
    };

    void client.auth.getSession().then(({ data }) => applySession(data.session));
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      // Supabase asks that the callback itself never awaits client calls; defer instead.
      window.setTimeout(() => void applySession(session), 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = requireClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw mapSupabaseAuthError(error);
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, username: string): Promise<SignUpResult> => {
      const client = requireClient();
      const name = username.toLowerCase();
      const invalid = validateUsername(name);
      if (invalid) throw new AuthError('username-invalid', invalid);
      if (!(await isUsernameAvailable(client, name))) {
        throw new AuthError('username-taken', 'That username is taken.');
      }
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { username: name } },
      });
      if (error) throw mapSupabaseAuthError(error);
      // With email confirmation on, Supabase returns a user with no identities for an address
      // that already exists, rather than an error, to prevent enumeration.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        throw new AuthError('email-taken', 'An account with this email already exists.');
      }
      return data.session ? { kind: 'signed-in' } : { kind: 'confirm-email', email };
    },
    [],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw mapSupabaseAuthError(error);
    setUser(null);
    setStatus('signed-out');
  }, []);

  const checkUsername = useCallback((username: string) => {
    const client = requireClient();
    return isUsernameAvailable(client, username);
  }, []);

  const changeUsername = useCallback(
    async (username: string) => {
      const client = requireClient();
      if (!user) throw new AuthError('unknown', 'Not signed in.');
      const name = username.toLowerCase();
      const invalid = validateUsername(name);
      if (invalid) throw new AuthError('username-invalid', invalid);
      await updateUsername(client, user.id, name);
      setUser({ ...user, username: name });
    },
    [user],
  );

  const state = useMemo<AuthState>(
    () => ({
      status,
      user,
      signIn,
      signUp,
      signOut,
      isUsernameAvailable: checkUsername,
      updateUsername: changeUsername,
    }),
    [status, user, signIn, signUp, signOut, checkUsername, changeUsername],
  );

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
