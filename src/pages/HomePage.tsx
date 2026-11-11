import { useState } from 'react';
import { Link } from 'react-router';
import { LinkButton } from '../components/Button/LinkButton';
import { PageShell } from '../components/PageShell/PageShell';
import { Seal } from '../components/Seal/Seal';
import { CONTENT } from '../content/content.config';
import { useAuth } from '../features/auth/authContext';
import styles from './HomePage.module.css';

interface MenuEntry {
  key: string;
  label: string;
  to: string | null;
  preview: { title: string; body: string; cta?: string };
}

const ENTRIES: readonly MenuEntry[] = [
  {
    key: 'play',
    label: 'Play vs Bot',
    to: '/play',
    preview: {
      title: 'Play vs Bot',
      body: `Three difficulties. ${CONTENT.difficulties.easy.name} ${CONTENT.difficulties.easy.blurb.toLowerCase()} ${CONTENT.difficulties.hard.name} ${CONTENT.difficulties.hard.blurb.toLowerCase()}`,
      cta: 'Choose a difficulty',
    },
  },
  {
    key: 'practice',
    label: 'Practice',
    to: '/practice',
    preview: {
      title: 'Practice',
      body: `Pick a ${CONTENT.terms.jutsu}, see its ${CONTENT.terms.signPlural}, and get live feedback on each one with no opponent.`,
      cta: 'Pick a jutsu',
    },
  },
  {
    key: 'book',
    label: 'Jutsu Book',
    to: '/jutsu-book',
    preview: {
      title: 'Jutsu Book',
      body: `Every ${CONTENT.terms.jutsu} with its element, sequence and damage, plus how to form all twelve ${CONTENT.terms.signPlural}.`,
      cta: 'Open the book',
    },
  },
  {
    key: 'history',
    label: 'Match History',
    to: '/history',
    preview: {
      title: 'Match History',
      body: 'No matches yet. Your first duel starts here.',
      cta: 'See history',
    },
  },
  {
    key: 'settings',
    label: 'Settings',
    to: '/settings',
    preview: {
      title: 'Settings',
      body: 'Theme, input mode, camera, detection threshold, key bindings, volume and your username.',
      cta: 'Open settings',
    },
  },
  {
    key: 'online',
    label: 'Online 1v1',
    to: null,
    preview: {
      title: 'Online 1v1',
      body: 'Queue up and fight another player with live webcam video. Coming after the demo.',
    },
  },
];

export function HomePage() {
  const { user } = useAuth();
  const [activeKey, setActiveKey] = useState<string>('play');
  const active = ENTRIES.find((entry) => entry.key === activeKey) ?? ENTRIES[0];

  return (
    <PageShell wide>
      <h1 className="visually-hidden">Home</h1>
      <div className={styles.layout}>
        <nav aria-label="Menu" className={styles.menu}>
          <ul className={styles.list}>
            {ENTRIES.map((entry) => {
              const isActive = entry.key === activeKey;
              const common = {
                className: `t-display-sm ${styles.entry}`,
                'data-active': isActive || undefined,
                onMouseEnter: () => setActiveKey(entry.key),
                onFocus: () => setActiveKey(entry.key),
              };
              return (
                <li key={entry.key}>
                  {entry.to ? (
                    <Link to={entry.to} {...common}>
                      <span className={styles.marker} aria-hidden="true" />
                      {entry.label}
                    </Link>
                  ) : (
                    <span {...common} data-disabled tabIndex={0} aria-disabled="true">
                      <span className={styles.marker} aria-hidden="true" />
                      {entry.label}
                      <span className={styles.soon}>
                        <Seal size={24} variant="empty" decorative />
                        Coming soon
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <aside className={styles.preview} aria-live="polite">
          {active ? (
            <>
              <p className={styles.previewTitle}>{active.preview.title}</p>
              <p className="t-secondary">{active.preview.body}</p>
              {active.to && active.preview.cta ? (
                <div className={styles.previewAction}>
                  <LinkButton to={active.to} variant="primary">
                    {active.preview.cta}
                  </LinkButton>
                </div>
              ) : null}
            </>
          ) : null}
          {user?.username ? <p className={styles.signedIn}>Signed in as {user.username}.</p> : null}
        </aside>
      </div>
    </PageShell>
  );
}
