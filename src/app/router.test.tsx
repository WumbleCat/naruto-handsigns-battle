// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/Toast/Toast';
import { CONTENT } from '../content/content.config';
import { AuthContext, type AuthState } from '../features/auth/authContext';
import { settingsStore } from '../lib/settings/store';
import { ThemeProvider } from './providers/ThemeProvider';
import { createTestRouter } from './router';

function fakeAuth(overrides: Partial<AuthState> = {}): AuthState {
  return {
    status: 'signed-out',
    user: null,
    signIn: vi.fn(() => Promise.resolve()),
    signUp: vi.fn(() => Promise.resolve({ kind: 'signed-in' as const })),
    signOut: vi.fn(() => Promise.resolve()),
    isUsernameAvailable: vi.fn(() => Promise.resolve(true)),
    updateUsername: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

function Providers({ auth, children }: { auth: AuthState; children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
      </ToastProvider>
    </ThemeProvider>
  );
}

function renderAt(path: string, auth: AuthState = fakeAuth()) {
  const router = createTestRouter([path]);
  render(
    <Providers auth={auth}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return router;
}

afterEach(() => {
  settingsStore.reset();
});

describe('router', () => {
  it('shows the landing page at /', async () => {
    renderAt('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: CONTENT.game.tagline }),
    ).toBeInTheDocument();
  });

  it('sends signed-in players from / to /home', async () => {
    const router = renderAt(
      '/',
      fakeAuth({ status: 'signed-in', user: { id: '1', email: 'a@b.c', username: 'sakura' } }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Home' });
    expect(router.state.location.pathname).toBe('/home');
  });

  it('redirects a signed-out visitor from a protected page to login with a return path', async () => {
    const router = renderAt('/settings');
    await screen.findByRole('heading', { level: 1, name: 'Log in' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?returnTo=%2Fsettings');
  });

  it('renders the 404 page for unknown paths', async () => {
    renderAt('/nothing-here');
    expect(
      await screen.findByRole('heading', { level: 1, name: "This page doesn't exist." }),
    ).toBeInTheDocument();
  });

  it('sends /play/battle back to /play without a battle setup', async () => {
    const router = renderAt(
      '/play/battle',
      fakeAuth({ status: 'signed-in', user: { id: '1', email: null, username: 'sakura' } }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Choose your opponent' });
    expect(router.state.location.pathname).toBe('/play');
  });

  it('changes the theme from Settings', async () => {
    renderAt(
      '/settings',
      fakeAuth({ status: 'signed-in', user: { id: '1', email: null, username: 'sakura' } }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await userEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(settingsStore.get().theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('logs out from the app chrome', async () => {
    const auth = fakeAuth({
      status: 'signed-in',
      user: { id: '1', email: null, username: 'sakura' },
    });
    renderAt('/home', auth);
    await screen.findByRole('heading', { level: 1, name: 'Home' });
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});
