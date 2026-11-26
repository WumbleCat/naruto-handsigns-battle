// /duel/bot/:level. An offline duel against the bot: no server, no lobby, straight to the
// countdown. The battle screen is the online one, fed by a match hosted in this tab.
import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { Banner } from '../../components/Banner/Banner';
import { LinkButton } from '../../components/Button/LinkButton';
import { PageShell } from '../../components/PageShell/PageShell';
import { Spinner } from '../../components/Spinner/Spinner';
import { isBotLevel, type BotLevel } from '@jutsu-duel/duel-shared';
import { modelStore, useModelState } from '../../detection/model';
import { useLocalDuelSession } from '../local/useLocalDuelSession';
import { loadIdentity, type DuelIdentity } from '../net/duelClient';
import { DuelBattle } from './DuelBattle';
import styles from './duel.module.css';

const FALLBACK_NICKNAME = 'You';

export function DuelBotPage() {
  const { level = '' } = useParams();
  const model = useModelState();
  const [saved] = useState(loadIdentity);
  const wantsWebcam = saved.inputMode === 'webcam';

  useEffect(() => {
    if (wantsWebcam && model.status === 'unknown') void modelStore.load();
  }, [wantsWebcam, model.status]);

  if (!isBotLevel(level)) {
    return (
      <PageShell>
        <h1 className="t-display-md">No such bot</h1>
        <Banner tone="danger">Bots come in easy, normal and hard. Pick one to start.</Banner>
        <div className={styles.actions}>
          <LinkButton to="/duel" variant="primary">
            Choose a bot
          </LinkButton>
        </div>
      </PageShell>
    );
  }
  // The match starts counting down as soon as it mounts, so settle the input mode first.
  if (wantsWebcam && (model.status === 'unknown' || model.status === 'loading')) {
    return (
      <PageShell centered>
        <Spinner label="Checking for the recognition model" />
      </PageShell>
    );
  }
  const identity: DuelIdentity = {
    nickname: saved.nickname.trim() || FALLBACK_NICKNAME,
    inputMode: wantsWebcam && model.status === 'available' ? 'webcam' : 'mock',
  };
  return <BotMatch key={level} level={level} identity={identity} />;
}

function BotMatch({ level, identity }: { level: BotLevel; identity: DuelIdentity }) {
  const session = useLocalDuelSession(level, identity.nickname);
  if (session.status === 'left') return <Navigate to="/duel" replace />;
  return <DuelBattle session={session} identity={identity} />;
}
