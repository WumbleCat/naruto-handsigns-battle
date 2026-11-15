// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HandLandmarks } from '../../detection/types';
import { settingsStore } from '../../lib/settings/store';

const { refs } = vi.hoisted(() => {
  const refs: Record<string, { width: number; height: number; hands: HandLandmarks[] } | null> = {};
  return { refs };
});
vi.mock('./signReferences', () => ({
  signReference: (sign: string) => refs[sign] ?? null,
}));

import { SignFigure } from './SignFigure';

function hand(x: number): HandLandmarks {
  const landmarks = Array.from({ length: 21 }, (_, i) => ({ x, y: 0.1 + i * 0.02, z: 0 }));
  return { handedness: 'Right', score: 1, landmarks, worldLandmarks: landmarks };
}

afterEach(() => {
  settingsStore.reset();
  for (const key of Object.keys(refs)) delete refs[key];
});

describe('SignFigure', () => {
  it('falls back to the glyph when no reference is recorded', () => {
    const { container } = render(<SignFigure sign="tiger" />);
    expect(screen.queryByRole('img', { name: /How to form/ })).toBeNull();
    expect(screen.getByRole('img', { name: 'Tiger' })).toBeInTheDocument();
    expect(container.querySelector('line')).toBeNull();
  });

  it('draws the recorded skeleton, mirrored to match the camera preview', () => {
    refs.tiger = { width: 100, height: 100, hands: [hand(0.2)] };
    const { container, rerender } = render(<SignFigure sign="tiger" />);
    expect(screen.getByRole('img', { name: 'How to form Tiger' })).toBeInTheDocument();
    expect(container.querySelectorAll('circle')).toHaveLength(21);
    // mirrorVideo defaults to on: x = 0.2 lands at 0.8.
    expect(container.querySelector('circle')?.getAttribute('cx')).toBe('0.8');

    settingsStore.update({ mirrorVideo: false });
    rerender(<SignFigure sign="tiger" />);
    expect(container.querySelector('circle')?.getAttribute('cx')).toBe('0.2');
  });

  it('is hidden from assistive tech when decorative', () => {
    refs.ram = { width: 160, height: 90, hands: [hand(0.5)] };
    const { container } = render(<SignFigure sign="ram" decorative />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
