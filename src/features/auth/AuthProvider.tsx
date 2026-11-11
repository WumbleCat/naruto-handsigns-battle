// Placeholder auth provider: the app is signed out and every action explains that accounts
// are not configured yet. feat/supabase-auth replaces this file with the Supabase-backed one;
// the context shape in authContext.ts is the contract the pages are written against.
import { useMemo, type ReactNode } from 'react';
import { AuthContext, AuthError, type AuthState } from './authContext';

const NOT_CONFIGURED = () =>
  new AuthError(
    'not-configured',
    'Accounts are not set up yet. Supabase arrives in the next step.',
  );

export function AuthProvider({ children }: { children: ReactNode }) {
  const state = useMemo<AuthState>(
    () => ({
      status: 'signed-out',
      user: null,
      signIn: () => Promise.reject(NOT_CONFIGURED()),
      signUp: () => Promise.reject(NOT_CONFIGURED()),
      signOut: () => Promise.resolve(),
      isUsernameAvailable: () => Promise.resolve(true),
      updateUsername: () => Promise.reject(NOT_CONFIGURED()),
    }),
    [],
  );

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
