// Vitest setup: registers jest-dom matchers (toBeInTheDocument, toHaveTextContent, ...) and
// unmounts rendered trees after each test. Loaded for every test file; the DOM parts are only
// exercised by jsdom-environment tests.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
