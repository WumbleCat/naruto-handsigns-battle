// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError, useAuth, type AuthState } from './authContext';

// A minimal fake of the Supabase client surface the provider touches.
const fake = vi.hoisted(() => {
  const subscription = { unsubscribe: vi.fn() };
  const state = {
    session: null as null | {
      user: { id: string; email: string; user_metadata: Record<string, unknown> };
    },
    profileUsername: 'sakura' as string | null,
    rpcResult: true,
    signInError: null as null | { code: string; message: string; status?: number },
    signUpResponse: { user: { identities: [{}] }, session: null } as {
      user: { identities: unknown[] } | null;
      session: unknown;
    },
  };
  const client = {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: state.session }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription } })),
      signInWithPassword: vi.fn(() => Promise.resolve({ data: {}, error: state.signInError })),
      signUp: vi.fn(() => Promise.resolve({ data: state.signUpResponse, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: state.profileUsername ? { id: 'u1', username: state.profileUsername } : null,
              error: null,
            }),
        }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: state.rpcResult, error: null })),
  };
  return { client, state, subscription };
});

vi.mock('../../lib/supabase', () => ({ supabase: fake.client }));

import { AuthProvider } from './AuthProvider';

let latest: AuthState | null = null;

function Probe() {
  const auth = useAuth();
  useEffect(() => {
    latest = auth;
  });
  return (
    <p>
      {auth.status}
      {auth.user?.username ? `:${auth.user.username}` : ''}
    </p>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  latest = null;
  fake.state.session = null;
  fake.state.profileUsername = 'sakura';
  fake.state.rpcResult = true;
  fake.state.signInError = null;
  fake.state.signUpResponse = { user: { identities: [{}] }, session: null };
  vi.clearAllMocks();
});

describe('AuthProvider (Supabase)', () => {
  it('restores a stored session and loads the profile username', async () => {
    fake.state.session = { user: { id: 'u1', email: 'a@b.c', user_metadata: {} } };
    renderProvider();
    expect(screen.getByText('loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('signed-in:sakura')).toBeInTheDocument());
  });

  it('is signed out without a session', async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByText('signed-out')).toBeInTheDocument());
  });

  it('maps invalid credentials to a typed error', async () => {
    fake.state.signInError = { code: 'invalid_credentials', message: 'Invalid login credentials' };
    renderProvider();
    await waitFor(() => expect(latest?.status).toBe('signed-out'));
    await expect(latest!.signIn('a@b.c', 'nope')).rejects.toMatchObject({
      code: 'invalid-credentials',
    });
  });

  it('refuses a taken username before calling signUp', async () => {
    fake.state.rpcResult = false;
    renderProvider();
    await waitFor(() => expect(latest?.status).toBe('signed-out'));
    await expect(latest!.signUp('a@b.c', 'password123', 'sakura')).rejects.toMatchObject({
      code: 'username-taken',
    });
    expect(fake.client.auth.signUp).not.toHaveBeenCalled();
  });

  it('reports confirm-email when sign up returns no session', async () => {
    renderProvider();
    await waitFor(() => expect(latest?.status).toBe('signed-out'));
    await expect(latest!.signUp('a@b.c', 'password123', 'Sakura_1')).resolves.toEqual({
      kind: 'confirm-email',
      email: 'a@b.c',
    });
    expect(fake.client.auth.signUp).toHaveBeenCalledWith({
      email: 'a@b.c',
      password: 'password123',
      options: { data: { username: 'sakura_1' } },
    });
  });

  it('treats a user with no identities as an existing email', async () => {
    fake.state.signUpResponse = { user: { identities: [] }, session: null };
    renderProvider();
    await waitFor(() => expect(latest?.status).toBe('signed-out'));
    await expect(latest!.signUp('a@b.c', 'password123', 'newname')).rejects.toBeInstanceOf(
      AuthError,
    );
  });

  it('signs out and clears the user', async () => {
    fake.state.session = { user: { id: 'u1', email: 'a@b.c', user_metadata: {} } };
    renderProvider();
    await waitFor(() => expect(latest?.status).toBe('signed-in'));
    await act(async () => {
      await latest!.signOut();
    });
    expect(fake.client.auth.signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText('signed-out')).toBeInTheDocument());
  });
});
