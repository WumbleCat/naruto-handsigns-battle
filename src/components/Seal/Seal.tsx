import type { CSSProperties } from 'react';
import { CONTENT } from '../../content/content.config';
import type { ThemedElement } from '../../content/types';
import type { SignId } from '../../engine/types';
import { Glyph } from './Glyph';
import type { GlyphId } from './glyphs';
import styles from './Seal.module.css';

export type SealSize = 24 | 32 | 48 | 64 | 96;
export type SealVariant = 'outline' | 'stamped' | 'ring' | 'empty';

export interface SealProps {
  /** Element glyph to show (mutually exclusive with `sign`). */
  element?: ThemedElement;
  /** Sign glyph to show. Pair with `tint` to colour it by the opener's element. */
  sign?: SignId;
  /** Element whose colour the seal takes when showing a sign. */
  tint?: ThemedElement;
  size?: SealSize;
  variant?: SealVariant;
  /** Ring variant only: 0..1 of the ring filled. */
  progress?: number;
  /** Play the one-shot stamp pulse (the moment a sign registers or a projectile launches). */
  pulse?: boolean;
  /** Accessible name; defaults to the element or sign name from the content config. */
  label?: string;
  className?: string;
}

function defaultLabel(element?: ThemedElement, sign?: SignId): string | undefined {
  if (sign) return CONTENT.signs[sign].name;
  if (element) return CONTENT.elements[element].name;
  return undefined;
}

export function Seal({
  element,
  sign,
  tint,
  size = 32,
  variant = 'outline',
  progress = 0,
  pulse = false,
  label,
  className,
}: SealProps) {
  const glyph: GlyphId | undefined = sign ?? element;
  const colourElement = tint ?? (sign ? undefined : element);
  const name = label ?? defaultLabel(element, sign);
  const style = {
    '--seal-size': `${size}px`,
    '--seal-progress': `${Math.max(0, Math.min(1, progress)) * 360}deg`,
  } as CSSProperties;

  return (
    <span
      className={[styles.seal, className].filter(Boolean).join(' ')}
      data-element={colourElement}
      data-variant={variant}
      data-pulse={pulse || undefined}
      style={style}
      role={name ? 'img' : undefined}
      aria-label={name}
      aria-hidden={name ? undefined : true}
    >
      {variant === 'ring' ? <span className={styles.ring} aria-hidden="true" /> : null}
      {glyph && variant !== 'empty' ? (
        <Glyph id={glyph} size={Math.round(size * 0.55)} className={styles.glyph} />
      ) : null}
    </span>
  );
}
