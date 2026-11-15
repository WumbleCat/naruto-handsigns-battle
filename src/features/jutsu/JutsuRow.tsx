import { LinkButton } from '../../components/Button/LinkButton';
import { Seal } from '../../components/Seal/Seal';
import { BALANCE } from '../../content/balance.config';
import { CONTENT } from '../../content/content.config';
import type { RosterJutsuDef } from '../../content/roster';
import { counterOf } from '../../engine/elements';
import { damageOf } from './damageOf';
import styles from './JutsuRow.module.css';
import { SignFigure } from './SignFigure';

export interface JutsuRowProps {
  jutsu: RosterJutsuDef;
  /** Show the "Practice" link. */
  practiceLink?: boolean;
  /** Highlight (the jutsu being practised). */
  active?: boolean;
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace(/\.0$/, '')} s`;
}

/** One jutsu: name, element, the sequence as seals, damage, and what it beats and loses to. */
export function JutsuRow({ jutsu, practiceLink = true, active = false }: JutsuRowProps) {
  const name = CONTENT.jutsus[jutsu.id].name;
  const element = jutsu.element ?? 'substitution';
  const damage = damageOf(jutsu);
  const cycle = BALANCE.elementCycle;
  const beats = jutsu.element ? cycle[(cycle.indexOf(jutsu.element) + 1) % cycle.length] : null;
  const losesTo = jutsu.element ? counterOf(cycle, jutsu.element) : null;

  return (
    <article className={styles.row} data-active={active || undefined} data-element={element}>
      <div className={styles.head}>
        <Seal element={element} size={32} />
        <h3 className={`t-display-sm ${styles.name}`}>{name}</h3>
        <span className={styles.flavour}>{CONTENT.jutsus[jutsu.id].flavour}</span>
      </div>
      <ol className={styles.sequence} aria-label={`${name} sequence`}>
        {jutsu.sequence.map((sign, index) => (
          <li key={`${sign}-${index}`} className={styles.step}>
            <SignFigure sign={sign} tint={element} size={72} decorative />
            <span className={styles.stepLabel}>
              <Seal sign={sign} tint={element} size={24} decorative />
              <span className={styles.stepName}>{CONTENT.signs[sign].name}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className={styles.facts}>
        {damage !== null ? (
          <>
            <span className={styles.fact}>
              <strong>{damage}</strong> damage
            </span>
            <span className={styles.fact}>
              Beats {beats ? CONTENT.elements[beats].name : ''}. Loses to{' '}
              {losesTo ? CONTENT.elements[losesTo].name : ''}.
            </span>
          </>
        ) : (
          <span className={styles.fact}>
            Negates a {CONTENT.terms.jutsu} in flight. {seconds(BALANCE.substitutionCooldownMs)}{' '}
            cooldown.
          </span>
        )}
      </p>
      {practiceLink ? (
        <div className={styles.action}>
          <LinkButton to={`/practice/${jutsu.id}`} variant="ghost">
            Practice
          </LinkButton>
        </div>
      ) : null}
    </article>
  );
}
