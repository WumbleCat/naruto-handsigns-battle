import { Seal } from '../../components/Seal/Seal';
import { CONTENT } from '../../content/content.config';
import { SIGN_IDS, type SignId } from '../../engine/types';
import { keyLabel } from './keyLabel';
import styles from './KeyMap.module.css';

export interface KeyMapProps {
  bindings: Record<SignId, string>;
  /** The sign whose key is currently held. */
  held?: SignId | null;
  /** 24 px seals and no names, for the battle stage. */
  compact?: boolean;
}

/** The twelve signs with their keys, in zodiac order on a four-by-three block. */
export function KeyMap({ bindings, held = null, compact = false }: KeyMapProps) {
  return (
    <ol className={styles.grid} data-compact={compact || undefined} aria-label="Key bindings">
      {SIGN_IDS.map((sign) => (
        <li key={sign} className={styles.key} data-held={held === sign || undefined}>
          <kbd className={styles.cap}>{keyLabel(bindings[sign])}</kbd>
          <Seal sign={sign} size={compact ? 24 : 32} decorative />
          {compact ? null : <span className={styles.name}>{CONTENT.signs[sign].name}</span>}
        </li>
      ))}
    </ol>
  );
}
