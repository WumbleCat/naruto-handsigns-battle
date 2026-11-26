import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests for the duel, online and against the bot. Starts the Vite dev server and the duel server (or
 * reuses running ones) and drives two independent browser contexts with the installed Chrome.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run duel:server',
      url: 'http://localhost:2567/health',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
