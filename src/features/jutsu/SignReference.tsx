import { Seal } from '../../components/Seal/Seal';
import { CONTENT } from '../../content/content.config';
import type { SignId } from '../../engine/types';
import { useSettings } from '../../lib/settings/store';
import { keyLabel } from '../battle/keyLabel';
import { signReference } from './signReferences';
import styles from './SignReference.module.css';
import { SkeletonFigure } from './SkeletonFigure';

export interface SignReferenceProps {
  sign: SignId;
  /** KeyboardEvent.code bound to this sign. */
  keyCode: string;
}

/** One sign: glyph, name, how to form it (skeleton or words), and its key. */
export function SignReference({ sign, keyCode }: SignReferenceProps) {
  const reference = signReference(sign);
  const mirror = useSettings().mirrorVideo;
  const name = CONTENT.signs[sign].name;
  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <Seal sign={sign} size={64} />
        <div>
          <h3 className={`t-display-sm ${styles.name}`}>{name}</h3>
          <p className={styles.key}>
            Key <kbd className={styles.cap}>{keyLabel(keyCode)}</kbd>
          </p>
        </div>
      </div>
      {reference ? (
        <SkeletonFigure
          hands={reference.hands}
          width={reference.width}
          height={reference.height}
          size={200}
          mirror={mirror}
          label={`How to form ${name}`}
        />
      ) : null}
      <p className={styles.pose}>{CONTENT.signs[sign].pose}</p>
      {reference ? null : (
        <p className={styles.missing}>
          Reference not recorded yet. The description above is the guide.
        </p>
      )}
    </article>
  );
}
