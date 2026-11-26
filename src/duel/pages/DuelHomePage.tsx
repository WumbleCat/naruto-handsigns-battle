// Home of the duel: nickname, input mode, then an offline match against a bot or an online
// one created or joined by code (spec section 06.1).
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Banner } from '../../components/Banner/Banner';
import { Button } from '../../components/Button/Button';
import { PageShell } from '../../components/PageShell/PageShell';
import { SegmentedControl } from '../../components/SegmentedControl/SegmentedControl';
import { TextField } from '../../components/TextField/TextField';
import {
  BOT_LEVELS,
  BOT_PARAMS,
  DUEL_CONFIG,
  type BotLevel,
  type InputMode,
} from '@jutsu-duel/duel-shared';
import { modelStore, useModelState } from '../../detection/model';
import {
  createDuelRoom,
  describeJoinError,
  duelServerUrl,
  handOffRoom,
  loadIdentity,
  rememberSession,
  saveIdentity,
} from '../net/duelClient';
import { ControlsTable } from './ControlsTable';
import styles from './duel.module.css';

const MODE_OPTIONS: readonly { value: InputMode; label: string; disabled?: boolean }[] = [
  { value: 'mock', label: 'Mock hand signs' },
  { value: 'webcam', label: 'Webcam hand signs' },
];

const LEVEL_LABELS: Readonly<Record<BotLevel, string>> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
};
const LEVEL_OPTIONS = BOT_LEVELS.map((level) => ({ value: level, label: LEVEL_LABELS[level] }));

export function DuelHomePage() {
  const navigate = useNavigate();
  const model = useModelState();
  const [identity, setIdentity] = useState(loadIdentity);
  const [code, setCode] = useState('');
  const [level, setLevel] = useState<BotLevel>('easy');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (model.status === 'unknown') void modelStore.load();
  }, [model.status]);

  const webcamAvailable = model.status === 'available';
  const inputMode: InputMode =
    identity.inputMode === 'webcam' && webcamAvailable ? 'webcam' : 'mock';
  const nicknameOk = identity.nickname.trim().length > 0;

  const persist = () => {
    const trimmed = { ...identity, nickname: identity.nickname.trim(), inputMode };
    saveIdentity(trimmed);
    return trimmed;
  };

  const create = async () => {
    if (!nicknameOk) return;
    setBusy('create');
    setError(null);
    try {
      const room = await createDuelRoom(persist());
      handOffRoom(room);
      rememberSession(room, { nickname: identity.nickname.trim(), inputMode });
      void navigate(`/duel/${room.roomId}`);
    } catch (reason) {
      setError(describeJoinError(reason));
      setBusy(null);
    }
  };

  const startBot = () => {
    persist();
    void navigate(`/duel/bot/${level}`);
  };

  const join = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!nicknameOk || trimmed.length === 0) return;
    persist();
    setBusy('join');
    void navigate(`/duel/${encodeURIComponent(trimmed)}`);
  };

  return (
    <PageShell>
      <header className={styles.header}>
        <h1 className="t-display-md">Duel</h1>
        <p className="t-lead measure">
          Two fighters, one arena. Move with the keys, weave hand signs to cast, dodge what comes
          back. Fight a bot offline or another player online; your camera never leaves this device.
        </p>
      </header>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <div className={styles.setup}>
        <TextField
          label="Nickname"
          value={identity.nickname}
          maxLength={DUEL_CONFIG.limits.nicknameMaxLength}
          onChange={(event) =>
            setIdentity((current) => ({ ...current, nickname: event.target.value }))
          }
          helper="Shown to your opponent. No account needed, and a bot does not mind if it is empty."
          data-testid="nickname"
        />
        <SegmentedControl<InputMode>
          label="Hand signs"
          options={MODE_OPTIONS.map((option) => ({
            ...option,
            disabled: option.value === 'webcam' && !webcamAvailable,
          }))}
          value={inputMode}
          onChange={(mode) => setIdentity((current) => ({ ...current, inputMode: mode }))}
        />
        <p className="t-small t-muted">
          {webcamAvailable
            ? 'Webcam mode uses the trained recognition model on this device. Mock mode uses the keys below and needs no camera.'
            : model.status === 'loading' || model.status === 'unknown'
              ? 'Checking for the recognition model.'
              : 'No recognition model is installed, so only mock hand signs are available. Train one as the README describes to unlock webcam signs.'}
        </p>
      </div>

      <div className={styles.modes}>
        <section className={styles.mode} aria-labelledby="bot-heading">
          <h2 id="bot-heading" className="t-heading">
            Against a bot
          </h2>
          <p className="t-small t-muted">Runs in this tab. No server or second player needed.</p>
          <SegmentedControl<BotLevel>
            label="Difficulty"
            options={LEVEL_OPTIONS}
            value={level}
            onChange={setLevel}
          />
          <p className={styles.levelNote} data-testid="bot-summary">
            {BOT_PARAMS[level].summary}
          </p>
          <Button variant="primary" size="lg" onClick={startBot} data-testid="start-bot-duel">
            Start bot duel
          </Button>
        </section>

        <section className={styles.mode} aria-labelledby="online-heading">
          <h2 id="online-heading" className="t-heading">
            Against a player
          </h2>
          <p className="t-small t-muted">
            Create a duel and share its code, or join with a code you were sent.
          </p>
          <Button
            size="lg"
            onClick={() => void create()}
            disabled={!nicknameOk || busy !== null}
            loading={busy === 'create'}
            data-testid="create-duel"
          >
            Create duel
          </Button>
          <form className={styles.joinForm} onSubmit={join}>
            <TextField
              label="Invite code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="From your opponent"
              data-testid="invite-code"
            />
            <Button
              type="submit"
              disabled={!nicknameOk || code.trim().length === 0 || busy !== null}
            >
              Join duel
            </Button>
          </form>
        </section>
      </div>

      <section className={styles.help} aria-labelledby="duel-controls">
        <h2 id="duel-controls" className="t-heading">
          Controls
        </h2>
        <ControlsTable inputMode={inputMode} />
        <p className="t-small t-muted">
          Online duels use the server at {duelServerUrl()}. Start it with{' '}
          <code>npm run duel:server</code>, or both servers with <code>npm run dev:duel</code>.
        </p>
      </section>
    </PageShell>
  );
}
