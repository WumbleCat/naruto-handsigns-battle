import { GLYPHS, type GlyphId } from './glyphs';

export interface GlyphProps {
  id: GlyphId;
  size?: number;
  className?: string;
}

/** Bare glyph, inheriting colour from `currentColor`. Decorative on its own. */
export function Glyph({ id, size = 24, className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[id]}
    </svg>
  );
}
