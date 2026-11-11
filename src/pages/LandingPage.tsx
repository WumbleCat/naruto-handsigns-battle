import { LinkButton } from '../components/Button/LinkButton';
import { Seal } from '../components/Seal/Seal';
import { BALANCE } from '../content/balance.config';
import { CONTENT } from '../content/content.config';
import { ELEMENTS } from '../engine/types';
import { ElementCycle } from '../features/landing/ElementCycle';
import { SignWheel } from '../features/landing/SignWheel';
import { VIEWPORT_DESIGNED_FOR } from '../lib/useViewport';
import styles from './LandingPage.module.css';

function formatSeconds(ms: number): string {
  return (ms / 1000).toFixed(1).replace(/\.0$/, '');
}

const CYCLE_SENTENCE =
  ELEMENTS.map((element, index) => {
    const next = ELEMENTS[(index + 1) % ELEMENTS.length] ?? element;
    return `${CONTENT.elements[element].name} beats ${CONTENT.elements[next].name}`;
  }).join(', ') + '.';

function Connector() {
  return (
    <svg className={styles.connector} viewBox="0 0 40 24" aria-hidden="true" focusable="false">
      <path
        d="M2 12h30m-8-8 8 8-8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LandingPage() {
  const flight = formatSeconds(BALANCE.flightMs);
  const cooldown = formatSeconds(BALANCE.substitutionCooldownMs);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <h1 className={`t-display-xl ${styles.headline}`}>{CONTENT.game.tagline}</h1>
          <p className="t-lead t-secondary measure">{CONTENT.game.description}</p>
          <div className={styles.ctas}>
            <LinkButton to="/signup" variant="primary" size="lg">
              Create account
            </LinkButton>
            <LinkButton to="/login" variant="ghost" size="lg">
              Log in
            </LinkButton>
          </div>
        </div>
        <SignWheel />
      </section>

      <section className={styles.section} aria-labelledby="how">
        <h2 id="how" className="t-display-sm">
          How a duel works
        </h2>
        <ol className={styles.steps}>
          <li className={styles.step}>
            <Seal sign="tiger" tint="fire" size={48} variant="stamped" decorative />
            <div>
              <p className={styles.stepTitle}>Weave a sequence</p>
              <p className="t-secondary">
                Hold each hand sign until it registers. Your trail shows the opponent every sign as
                it lands, so they can read what is coming.
              </p>
            </div>
          </li>
          <Connector />
          <li className={styles.step}>
            <Seal element="fire" size={48} decorative />
            <div>
              <p className={styles.stepTitle}>It flies for {flight} seconds</p>
              <p className="t-secondary">
                A finished {CONTENT.terms.jutsu} is in flight before it hits. Finish your own in
                that window and the two {CONTENT.terms.clash}: the stronger element lands harder,
                the weaker one softer.
              </p>
            </div>
          </li>
          <Connector />
          <li className={styles.step}>
            <Seal element="substitution" size={48} decorative />
            <div>
              <p className={styles.stepTitle}>Or substitute</p>
              <p className="t-secondary">
                Two quick signs negate a {CONTENT.terms.jutsu} in flight. Then{' '}
                {CONTENT.terms.substitution} needs {cooldown} seconds to recharge.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className={`${styles.section} ${styles.cycleSection}`} aria-labelledby="cycle">
        <div>
          <h2 id="cycle" className="t-display-sm">
            Five elements, one cycle
          </h2>
          <p className={`t-secondary measure ${styles.cycleText}`}>{CYCLE_SENTENCE}</p>
          <p className="t-secondary measure">
            Every {CONTENT.terms.jutsu} belongs to an element, and the first sign of its sequence
            gives it away. Reading that sign early is how you pick the counter.
          </p>
        </div>
        <ElementCycle />
      </section>

      <footer className={styles.footer}>
        <p>Your camera stays on your device. Nothing is uploaded.</p>
        <p>Desktop, {VIEWPORT_DESIGNED_FOR} px and wider. Chrome or Edge recommended.</p>
      </footer>
    </main>
  );
}
