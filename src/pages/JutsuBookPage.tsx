// Jutsu Book (docs/FRONTEND_DESIGN.md 6.8): every jutsu by element, then every sign.
import { PageShell } from '../components/PageShell/PageShell';
import { Seal } from '../components/Seal/Seal';
import { CONTENT } from '../content/content.config';
import { ROSTER, ROSTER_BY_ID } from '../content/roster';
import { ELEMENTS, SIGN_IDS } from '../engine/types';
import { JutsuRow } from '../features/jutsu/JutsuRow';
import { SignReference } from '../features/jutsu/SignReference';
import { useSettings } from '../lib/settings/store';
import styles from './JutsuBookPage.module.css';

export function JutsuBookPage() {
  const settings = useSettings();

  return (
    <PageShell wide>
      <header className={styles.header}>
        <h1 className="t-display-md">Jutsu Book</h1>
        <nav aria-label="On this page" className={styles.pageNav}>
          <a href="#jutsus">{CONTENT.terms.jutsuPlural}</a>
          <a href="#signs">{CONTENT.terms.signPlural}</a>
        </nav>
      </header>

      <section id="jutsus" aria-labelledby="jutsus-heading" className={styles.section}>
        <h2 id="jutsus-heading" className="visually-hidden">
          Jutsus
        </h2>
        {ELEMENTS.map((element) => (
          <section key={element} className={styles.group} aria-labelledby={`element-${element}`}>
            <div className={styles.groupHead}>
              <Seal element={element} size={64} />
              <div>
                <h3 id={`element-${element}`} className={`t-display-sm ${styles.groupTitle}`}>
                  {CONTENT.elements[element].name}
                </h3>
                <p className="t-secondary">{CONTENT.elements[element].blurb}</p>
              </div>
            </div>
            {ROSTER.filter((jutsu) => jutsu.element === element)
              .sort((a, b) => a.sequence.length - b.sequence.length)
              .map((jutsu) => (
                <JutsuRow key={jutsu.id} jutsu={jutsu} />
              ))}
          </section>
        ))}
        <section className={styles.group} aria-labelledby="element-substitution">
          <div className={styles.groupHead}>
            <Seal element="substitution" size={64} />
            <div>
              <h3 id="element-substitution" className={`t-display-sm ${styles.groupTitle}`}>
                {CONTENT.elements.substitution.name}
              </h3>
              <p className="t-secondary">{CONTENT.elements.substitution.blurb}</p>
            </div>
          </div>
          <JutsuRow jutsu={ROSTER_BY_ID.substitution} />
        </section>
      </section>

      <section id="signs" aria-labelledby="signs-heading" className={styles.section}>
        <h2 id="signs-heading" className="t-display-sm">
          The twelve {CONTENT.terms.signPlural}
        </h2>
        <p className="t-secondary measure">
          Every sequence is built from these. Hold a sign steady for a quarter second and it
          registers.
        </p>
        <div className={styles.signGrid}>
          {SIGN_IDS.map((sign) => (
            <SignReference key={sign} sign={sign} keyCode={settings.keyBindings[sign]} />
          ))}
        </div>
      </section>
    </PageShell>
  );
}
