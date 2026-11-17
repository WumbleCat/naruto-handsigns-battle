// /duel/:roomId. Joins or reconnects, then shows the lobby or the battle by the room's phase.
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { Banner } from '../../components/Banner/Banner';
import { Button } from '../../components/Button/Button';
import { LinkButton } from '../../components/Button/LinkButton';
import { PageShell } from '../../components/PageShell/PageShell';
import { SegmentedControl } from '../../components/SegmentedControl/SegmentedControl';
import { Spinner } from '../../components/Spinner/Spinner';
import { TextField } from '../../components/TextField/TextField';
import { DUEL_CONFIG, type InputMode } from '@jutsu-duel/duel-shared';
import { useModelState } from '../../detection/model';
import { loadIdentity, recallSession, saveIdentity, type DuelIdentity } from '../net/duelClient';
import { useDuelSession } from '../net/useDuelSession';
import { DuelBattle } from './DuelBattle';
import { DuelLobby } from './DuelLobby';
import styles from './duel.module.css';

export function DuelRoomPage() {
  const { roomId = '' } = useParams();
  const [identity, setIdentity] = useState<DuelIdentity | null>(() => {
    const stored = recallSession(roomId);
    if (stored) return { nickname: stored.nickname, inputMode: stored.inputMode };
    const saved = loadIdentity();
    return saved.nickname ? saved : null;
  });

  if (!roomId) return <Banner tone="danger">Missing invite code.</Banner>;
  if (!identity) {
    return (
      <JoinForm
        roomId={roomId}
        onJoin={(next) => {
          saveIdentity(next);
          setIdentity(next);
        }}
      />
    );
  }
  return <DuelRoomSession key={roomId} roomId={roomId} identity={identity} />;
}

function JoinForm({
  roomId,
  onJoin,
}: {
  roomId: string;
  onJoin: (identity: DuelIdentity) => void;
}) {
  const model = useModelState();
  const [nickname, setNickname] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('mock');
  const webcamAvailable = model.status === 'available';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) return;
    onJoin({
      nickname: trimmed,
      inputMode: inputMode === 'webcam' && webcamAvailable ? 'webcam' : 'mock',
    });
  };
  return (
    <PageShell>
      <h1 className="t-display-md">Join this duel</h1>
      <p className="t-secondary">
        Invite code <strong>{roomId}</strong>. Pick a nickname to take the second seat.
      </p>
      <form className={styles.setup} onSubmit={submit}>
        <TextField
          label="Nickname"
          value={nickname}
          maxLength={DUEL_CONFIG.limits.nicknameMaxLength}
          onChange={(event) => setNickname(event.target.value)}
          data-testid="nickname"
        />
        <SegmentedControl<InputMode>
          label="Hand signs"
          options={[
            { value: 'mock', label: 'Mock hand signs' },
            { value: 'webcam', label: 'Webcam hand signs', disabled: !webcamAvailable },
          ]}
          value={inputMode === 'webcam' && webcamAvailable ? 'webcam' : 'mock'}
          onChange={setInputMode}
        />
        <div className={styles.actions}>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={nickname.trim().length === 0}
            data-testid="join-duel"
          >
            Join duel
          </Button>
        </div>
      </form>
    </PageShell>
  );
}

function DuelRoomSession({ roomId, identity }: { roomId: string; identity: DuelIdentity }) {
  const session = useDuelSession(roomId, identity);

  if (session.status === 'error') {
    return (
      <PageShell>
        <h1 className="t-display-md">Could not join</h1>
        <Banner tone="danger">{session.error ?? 'Could not join the duel.'}</Banner>
        <div className={styles.actions}>
          <LinkButton to="/duel" variant="primary">
            Back to online duel
          </LinkButton>
        </div>
      </PageShell>
    );
  }
  if (session.status === 'left') {
    return (
      <PageShell>
        <h1 className="t-display-md">You left the duel</h1>
        {session.leaveReason ? <p className="t-secondary">{session.leaveReason}</p> : null}
        <div className={styles.actions}>
          <LinkButton to="/duel" variant="primary">
            Start another
          </LinkButton>
          <Link to="/">Back to the game</Link>
        </div>
      </PageShell>
    );
  }
  // The state object exists before the first patch; until then its fields are undefined.
  const synced =
    session.state !== null &&
    typeof session.state.phase === 'string' &&
    session.state.players !== undefined;
  if (!session.room || !session.state || !synced) {
    return (
      <PageShell centered>
        <Spinner label="Joining the duel" />
      </PageShell>
    );
  }
  const phase = session.state.phase;
  if (phase === 'WAITING' || phase === 'READY') {
    return <DuelLobby session={session} identity={identity} />;
  }
  return <DuelBattle session={session} identity={identity} />;
}
