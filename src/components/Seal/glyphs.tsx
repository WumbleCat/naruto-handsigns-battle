// Original minimal ideograms on a 24 px grid, 2 px stroke, round caps.
// docs/FRONTEND_DESIGN.md 4.2 (elements) and 4.3 (signs). Mnemonics, not hand illustrations.
// Data only; the <Glyph> component lives in Glyph.tsx.
import type { ReactElement } from 'react';
import type { ThemedElement } from '../../content/types';
import type { SignId } from '../../engine/types';

export type GlyphId = ThemedElement | SignId;

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const ELEMENT_GLYPHS: Record<ThemedElement, ReactElement> = {
  fire: (
    <path
      {...STROKE}
      d="M12 3c-3 4-6 7-6 11a6 6 0 0 0 12 0c0-2-1-4-2.2-5.2-.6 1.6-1.6 2.6-2.8 2.8C13.6 9.2 13.2 6 12 3Z"
    />
  ),
  wind: <path {...STROKE} d="M4 8h11M5 12h15M7 16h9" />,
  lightning: <path {...STROKE} d="M13 3 6 13h5l-1 8 8-11h-5l1-7Z" />,
  earth: <path {...STROKE} d="M3 19h18M6 19l3-7h6l3 7" />,
  water: (
    <path {...STROKE} d="M3 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
  ),
  substitution: <path {...STROKE} d="M18.5 7.5A8 8 0 0 0 5.5 7.5M5.5 16.5a8 8 0 0 0 13 0" />,
};

const SIGN_GLYPHS: Record<SignId, ReactElement> = {
  rat: (
    <>
      <circle cx="9" cy="10" r="2" fill="currentColor" />
      <path {...STROKE} d="M11 11c3 1 5 3 5 6s-2 4-4 3" />
    </>
  ),
  ox: <path {...STROKE} d="M5 15h14M8 15c-2-4-2-7-1-10M16 15c2-4 2-7 1-10" />,
  tiger: <path {...STROKE} d="M5 7c3 3 4 7 4 11M11 5c3 3 4 7 4 11M17 7c2 3 2 7 2 11" />,
  hare: <path {...STROKE} d="M6 20V8a2 2 0 0 1 4 0v12M14 20V8a2 2 0 0 1 4 0v12" />,
  dragon: (
    <path
      {...STROKE}
      d="M13 11a1.5 1.5 0 1 1-1.5 1.5A3.5 3.5 0 1 0 15 9a6 6 0 1 0-6 9.5A8 8 0 0 0 20 12"
    />
  ),
  snake: <path {...STROKE} d="M15 4c-5 0-7 2-7 4.5s7 3 7 6S12 19 8 19" />,
  horse: <path {...STROKE} d="M6 19v-8a6 6 0 0 1 12 0v8" />,
  ram: (
    <path
      {...STROKE}
      d="M12 6c-4 0-6 3-6 6a3 3 0 0 0 6 0 1.5 1.5 0 0 0-3 0M12 6c4 0 6 3 6 6a3 3 0 0 1-6 0 1.5 1.5 0 0 1 3 0"
    />
  ),
  monkey: (
    <>
      <circle {...STROKE} cx="11" cy="10" r="5" />
      <path {...STROKE} d="M15 14c2 2 3 4 1 6s-4 0-3-2" />
    </>
  ),
  bird: <path {...STROKE} d="M3 13c3-4 6-5 9-2 3-3 6-2 9 2" />,
  dog: (
    <>
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="12" cy="6" r="1.5" fill="currentColor" />
      <circle cx="16" cy="8" r="1.5" fill="currentColor" />
      <ellipse {...STROKE} cx="12" cy="15" rx="4" ry="3" />
    </>
  ),
  boar: <path {...STROKE} d="M7 17c-1-4 0-7 3-9M17 17c1-4 0-7-3-9" />,
};

export const GLYPHS: Record<GlyphId, ReactElement> = { ...ELEMENT_GLYPHS, ...SIGN_GLYPHS };
