// Practice list (docs/FRONTEND_DESIGN.md 6.7): free practice first, then every jutsu.
import { LinkButton } from '../components/Button/LinkButton';
import { PageShell } from '../components/PageShell/PageShell';
import { Seal } from '../components/Seal/Seal';
import { CONTENT } from '../content/content.config';
import { ROSTER, ROSTER_BY_ID } from '../content/roster';
import { ELEMENTS } from '../engine/types';
import { JutsuRow } from '../features/jutsu/JutsuRow';
import styles from './PracticePage.module.css';

export function PracticePage() {
  return (
    <PageShell wide>
      <h1 className="t-display-md">Practice</h1>
      <p className="t-lead t-secondary measure">
        Pick a {CONTENT.terms.jutsu} and weave it with live feedback on every sign, no opponent.
      </p>

      <article className={styles.free}>
        <Seal size={48} variant="empty" decorative />
        <div className={styles.freeText}>
          <h2 className="t-display-sm">Free practice</h2>
          <p className="t-secondary">See what the camera reads, with no target sequence.</p>
        </div>
        <LinkButton to="/practice/free" variant="primary">
          Start free practice
        </LinkButton>
      </article>

      {ELEMENTS.map((element) => (
        <section key={element} aria-labelledby={`practice-${element}`} className={styles.group}>
          <h2 id={`practice-${element}`} className={`t-display-sm ${styles.groupTitle}`}>
            {CONTENT.elements[element].name}
          </h2>
          {ROSTER.filter((jutsu) => jutsu.element === element)
            .sort((a, b) => a.sequence.length - b.sequence.length)
            .map((jutsu) => (
              <JutsuRow key={jutsu.id} jutsu={jutsu} />
            ))}
        </section>
      ))}
      <section aria-labelledby="practice-substitution" className={styles.group}>
        <h2 id="practice-substitution" className={`t-display-sm ${styles.groupTitle}`}>
          {CONTENT.elements.substitution.name}
        </h2>
        <JutsuRow jutsu={ROSTER_BY_ID.substitution} />
      </section>
    </PageShell>
  );
}
