// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToastProvider } from '../components/Toast/Toast';
import { CONTENT } from '../content/content.config';
import { AuthProvider } from '../features/auth/AuthProvider';
import { App } from './App';
import { ThemeProvider } from './providers/ThemeProvider';

describe('App', () => {
  it('boots to the landing page with the real providers', async () => {
    render(
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>,
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: CONTENT.game.tagline }),
    ).toBeInTheDocument();
  });
});
