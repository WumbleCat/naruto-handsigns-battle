// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToastProvider } from '../components/Toast/Toast';
import { CONTENT } from '../content/content.config';
import { App } from './App';
import { ThemeProvider } from './providers/ThemeProvider';

describe('App', () => {
  it('renders the game title', () => {
    render(
      <ThemeProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ThemeProvider>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(CONTENT.game.title);
  });
});
