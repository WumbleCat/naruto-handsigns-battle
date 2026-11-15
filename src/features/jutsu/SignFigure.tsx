import { Seal, type SealSize } from '../../components/Seal/Seal';
import { CONTENT } from '../../content/content.config';
import type { ThemedElement } from '../../content/types';
import type { SignId } from '../../engine/types';
import { useSettings } from '../../lib/settings/store';
import { signReference } from './signReferences';
import { SkeletonFigure } from './SkeletonFigure';

export interface SignFigureProps {
  sign: SignId;
  /** Rendered box in px. */
  size?: number;
  /** Element colour for the glyph shown when no reference exists. */
  tint?: ThemedElement;
  /** Hide from assistive tech when a parent already names the sign. */
  decorative?: boolean;
  /** Draw without the framed background, for use inside another tile. */
  bare?: boolean;
}

const SEAL_SIZES: readonly SealSize[] = [24, 32, 48, 64, 96];

function nearestSealSize(size: number): SealSize {
  return SEAL_SIZES.reduce((best, candidate) =>
    Math.abs(candidate - size) < Math.abs(best - size) ? candidate : best,
  );
}

/**
 * How to form a sign: the recorded hand skeleton from src/content/sign-references.json, drawn
 * mirrored when the player's camera preview is, so it can be copied straight off the screen.
 * Falls back to the sign's glyph until a reference has been recorded.
 */
export function SignFigure({
  sign,
  size = 64,
  tint,
  decorative = false,
  bare = false,
}: SignFigureProps) {
  const reference = signReference(sign);
  const mirror = useSettings().mirrorVideo;
  if (!reference) {
    return <Seal sign={sign} tint={tint} size={nearestSealSize(size)} decorative={decorative} />;
  }
  return (
    <SkeletonFigure
      hands={reference.hands}
      width={reference.width}
      height={reference.height}
      size={size}
      mirror={mirror}
      decorative={decorative}
      bare={bare}
      label={`How to form ${CONTENT.signs[sign].name}`}
    />
  );
}
