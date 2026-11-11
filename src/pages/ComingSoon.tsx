import { LinkButton } from '../components/Button/LinkButton';
import { PageShell } from '../components/PageShell/PageShell';
import styles from './ComingSoon.module.css';

interface ComingSoonProps {
  title: string;
  milestone: string;
  summary: string;
  /** Where "Back" goes; defaults to Home. */
  backTo?: string;
  backLabel?: string;
}

/** Stub for pages whose milestone has not shipped yet. Replaced page by page. */
export function ComingSoon({
  title,
  milestone,
  summary,
  backTo = '/home',
  backLabel = 'Back to home',
}: ComingSoonProps) {
  return (
    <PageShell>
      <h1 className="t-display-md">{title}</h1>
      <p className={`t-lead t-secondary measure ${styles.summary}`}>{summary}</p>
      <p className={styles.milestone}>Arrives in milestone {milestone}.</p>
      <div>
        <LinkButton to={backTo}>{backLabel}</LinkButton>
      </div>
    </PageShell>
  );
}
