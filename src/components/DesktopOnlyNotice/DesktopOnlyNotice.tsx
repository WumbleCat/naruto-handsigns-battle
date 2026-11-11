import { useState } from 'react';
import { CONTENT } from '../../content/content.config';
import { VIEWPORT_DESIGNED_FOR } from '../../lib/useViewport';
import { Button } from '../Button/Button';
import styles from './DesktopOnlyNotice.module.css';

/** Full-page replacement for the app below the blocking width (docs/FRONTEND_DESIGN.md 6.12). */
export function DesktopOnlyNotice() {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={styles.notice} role="main">
      <h1 className="t-display-md">{CONTENT.game.title} needs a desktop</h1>
      <p className={`${styles.body} measure`}>
        The game tracks both hands on a webcam and is designed for screens {VIEWPORT_DESIGNED_FOR}{' '}
        px and wider. Open this link on a computer to play.
      </p>
      <Button variant="primary" onClick={() => void copyLink()}>
        {copied ? 'Link copied' : 'Copy link'}
      </Button>
    </div>
  );
}
