// Results (docs/FRONTEND_DESIGN.md 6.6): the result word, the numbers that mattered, the
// jutsu you used, and the way back in.
import { Navigate, useNavigate } from 'react-router';
import { Button } from '../components/Button/Button';
import { LinkButton } from '../components/Button/LinkButton';
import { PageShell } from '../components/PageShell/PageShell';
import { Seal } from '../components/Seal/Seal';
import { Spinner } from '../components/Spinner/Spinner';
import { CONTENT } from '../content/content.config';
import { isRosterJutsuId, ROSTER_BY_ID } from '../content/roster';
import { useBattleSession } from '../features/battle/battleSessionContext';
import { formatClock } from '../features/battle/hud/formatClock';
import { useSaveMatch } from '../features/results/useSaveMatch';
import styles from './ResultsPage.module.css';

export function ResultsPage() {
  const session = useBattleSession();
  const navigate = useNavigate();
  const { outcome, setup } = session;
  const saveStatus = useSaveMatch(outcome, setup);

  if (!outcome || !setup) return <Navigate to="/play" replace />;

  const word =
    outcome.result === 'win'
      ? CONTENT.callouts.victory
      : outcome.result === 'loss'
        ? CONTENT.callouts.defeat
        : CONTENT.callouts.draw;
  const opponentName = CONTENT.difficulties[setup.difficulty].name;
  const how =
    outcome.endReason === 'ko'
      ? 'by knockout'
      : outcome.endReason === 'timeout'
        ? 'on time'
        : outcome.result === 'loss'
          ? 'by forfeit'
          : 'after a forfeit';

  const jutsus = Object.entries(outcome.jutsusUsed)
    .filter(([id]) => isRosterJutsuId(id))
    .sort((a, b) => b[1] - a[1]);

  const rematch = () => {
    session.start(setup);
    void navigate('/play/battle', { replace: true });
  };

  return (
    <PageShell wide>
      <div className={styles.layout}>
        <div className={styles.main}>
          <h1 className={`t-display-lg ${styles.word}`} data-result={outcome.result}>
            {word}
          </h1>
          <p className="t-lead t-secondary">
            against {opponentName} {how} in {formatClock(outcome.durationSeconds * 1000)}.
          </p>

          <section aria-labelledby="jutsus-used" className={styles.jutsus}>
            <h2 id="jutsus-used" className="t-heading">
              Jutsu used
            </h2>
            {jutsus.length === 0 ? (
              <p className="t-secondary">None. Next time, weave something.</p>
            ) : (
              <ul className={styles.jutsuList}>
                {jutsus.map(([id, count]) => {
                  if (!isRosterJutsuId(id)) return null;
                  const jutsu = ROSTER_BY_ID[id];
                  return (
                    <li key={id} className={styles.jutsuRow}>
                      <Seal element={jutsu.element ?? 'substitution'} size={32} decorative />
                      <span className={`t-display-sm ${styles.jutsuName}`}>
                        {CONTENT.jutsus[id].name}
                      </span>
                      <span className={styles.jutsuCount}>×{count}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className={styles.actions}>
            <Button variant="primary" size="lg" onClick={rematch}>
              Rematch
            </Button>
            <LinkButton to="/play" size="lg">
              Change difficulty
            </LinkButton>
            <LinkButton to="/home" variant="ghost" size="lg">
              Back to menu
            </LinkButton>
          </div>
        </div>

        <aside className={styles.stats} aria-label="Match statistics">
          <dl className={styles.statList}>
            <div>
              <dt>Damage dealt</dt>
              <dd>{outcome.damageDealt}</dd>
            </div>
            <div>
              <dt>Damage taken</dt>
              <dd>{outcome.damageTaken}</dd>
            </div>
            <div>
              <dt>HP left</dt>
              <dd>
                you {outcome.playerHpLeft}, {opponentName} {outcome.opponentHpLeft}
              </dd>
            </div>
            <div>
              <dt>Clashes won</dt>
              <dd>{outcome.clashesWon}</dd>
            </div>
            <div>
              <dt>Clashes lost</dt>
              <dd>{outcome.clashesLost}</dd>
            </div>
            <div>
              <dt>Substitutions</dt>
              <dd>{outcome.substitutions}</dd>
            </div>
          </dl>
          <p className={styles.saveStatus} data-status={saveStatus} aria-live="polite">
            {saveStatus === 'saving' ? (
              <>
                <Spinner size={14} /> Saving match
              </>
            ) : saveStatus === 'saved' ? (
              'Saved to your match history.'
            ) : saveStatus === 'queued' ? (
              "Couldn't save this match. It will be retried next time you open the game."
            ) : (
              'Not saved: play with an account to keep match history.'
            )}
          </p>
        </aside>
      </div>
    </PageShell>
  );
}
