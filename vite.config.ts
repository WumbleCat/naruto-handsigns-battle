import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    watch: {
      // Nothing under these is served; recordings in ml/data/raw are large and often locked
      // while the trainer reads them, which otherwise floods the console with EBUSY errors.
      ignored: ['**/ml/**', '**/supabase/**', '**/.claude/**'],
    },
  },
  test: {
    // Engine and library tests run in node. Component tests opt into jsdom per file with
    // `// @vitest-environment jsdom` at the top of the file.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'packages/**/*.test.ts', 'server/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
