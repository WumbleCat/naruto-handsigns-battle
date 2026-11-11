// Pre-battle: difficulty, input mode and the camera check (docs/FRONTEND_DESIGN.md 6.4).
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/Button/Button';
import { LinkButton } from '../components/Button/LinkButton';
import { PageShell } from '../components/PageShell/PageShell';
import { SegmentedControl } from '../components/SegmentedControl/SegmentedControl';
import { Spinner } from '../components/Spinner/Spinner';
import { VideoPanel } from '../components/VideoPanel/VideoPanel';
import { CONTENT } from '../content/content.config';
import { BOT_DIFFICULTIES, type BotDifficulty } from '../content/types';
import { isModelAvailable } from '../detection/createDetector';
import { useBattleSession } from '../features/battle/battleSessionContext';
import { BotAvatar } from '../features/battle/hud/BotAvatar';
import { KeyMap } from '../features/battle/KeyMap';
import { useCamera } from '../features/camera/useCamera';
import { useHandTracker } from '../features/camera/useHandTracker';
import { INPUT_MODES, type InputMode } from '../lib/settings/schema';
import { settingsStore, useSettings } from '../lib/settings/store';
import styles from './PlayPage.module.css';

const INPUT_OPTIONS: readonly { value: InputMode; label: string }[] = INPUT_MODES.map((value) => ({
  value,
  label: value === 'webcam' ? 'Webcam' : 'Keyboard',
}));

type CheckState = 'pending' | 'ok' | 'warn' | 'error';

function Check({ state, children }: { state: CheckState; children: string }) {
  const mark =
    state === 'ok' ? '✓' : state === 'error' ? '✕' : state === 'warn' ? '!' : <Spinner size={14} />;
  return (
    <li className={styles.check} data-state={state}>
      <span className={styles.checkMark} aria-hidden="true">
        {mark}
      </span>
      <span>{children}</span>
    </li>
  );
}

export function PlayPage() {
  const settings = useSettings();
  const session = useBattleSession();
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState<BotDifficulty>(
    session.setup?.difficulty ?? 'medium',
  );
  const inputMode = settings.inputMode;
  const webcam = inputMode === 'webcam';
  const modelAvailable = isModelAvailable();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attachVideo = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
  }, []);
  const { state: camera, retry } = useCamera({
    deviceId: settings.cameraDeviceId,
    enabled: webcam,
  });
  const stream = camera.status === 'ready' ? camera.stream : null;
  const tracker = useHandTracker(videoRef, stream, webcam);

  const cameraCheck: CheckState =
    camera.status === 'ready' ? 'ok' : camera.status === 'error' ? 'error' : 'pending';
  const trackingCheck: CheckState =
    tracker.status === 'ready'
      ? 'ok'
      : tracker.status === 'error'
        ? 'error'
        : camera.status === 'ready'
          ? 'pending'
          : 'pending';
  const modelCheck: CheckState = modelAvailable ? 'ok' : 'warn';

  const canStart =
    inputMode === 'keyboard' ||
    (cameraCheck === 'ok' && trackingCheck === 'ok' && modelCheck === 'ok');

  const start = () => {
    session.start({ difficulty, inputMode });
    void navigate('/play/battle');
  };

  const cameraError =
    camera.status === 'error'
      ? {
          'permission-denied': {
            title: 'Camera access is blocked.',
            body: "Allow the camera for this site in your browser's address bar, then reload.",
          },
          'not-found': {
            title: 'No camera found.',
            body: 'Connect one, or play with the keyboard.',
          },
          'in-use': {
            title: 'Another app is using the camera.',
            body: 'Close it and try again.',
          },
          unsupported: {
            title: 'This browser cannot use the camera.',
            body: 'Try Chrome or Edge, or play with the keyboard.',
          },
          ended: { title: 'Camera disconnected.', body: 'Reconnect it and try again.' },
          unknown: { title: 'The camera could not start.', body: camera.error.message },
        }[camera.error.code]
      : null;

  return (
    <PageShell wide>
      <h1 className="t-display-md">Choose your opponent</h1>

      <fieldset className={styles.difficulties}>
        <legend className="visually-hidden">Difficulty</legend>
        {BOT_DIFFICULTIES.map((level) => {
          const selected = level === difficulty;
          return (
            <label key={level} className={styles.difficulty} data-selected={selected || undefined}>
              <input
                type="radio"
                name="difficulty"
                value={level}
                checked={selected}
                onChange={() => setDifficulty(level)}
                className="visually-hidden"
              />
              <BotAvatar difficulty={level} name={CONTENT.difficulties[level].name} />
              <span className={styles.difficultyBlurb}>{CONTENT.difficulties[level].blurb}</span>
            </label>
          );
        })}
      </fieldset>

      <SegmentedControl<InputMode>
        label="Input"
        options={INPUT_OPTIONS}
        value={inputMode}
        onChange={(mode) => settingsStore.update({ inputMode: mode })}
      />

      {webcam ? (
        <section className={styles.cameraCheck} aria-labelledby="camera-check">
          <div className={styles.checks}>
            <h2 id="camera-check" className="t-heading">
              Camera check
            </h2>
            <ul className={styles.checkList}>
              <Check state={cameraCheck}>
                {camera.status === 'ready' ? 'Camera on' : 'Waiting for the camera'}
              </Check>
              <Check state={trackingCheck}>
                {tracker.status === 'ready' ? 'Hand tracking loaded' : 'Loading hand tracking'}
              </Check>
              <Check state={modelCheck}>
                {modelAvailable
                  ? 'Recognition model ready'
                  : 'No recognition model is installed yet. Keyboard mode is available.'}
              </Check>
            </ul>
            <p className="t-small t-muted">
              Change camera in{' '}
              <LinkButton to="/settings" variant="ghost">
                Settings
              </LinkButton>
            </p>
          </div>
          <div className={styles.preview}>
            <VideoPanel
              stream={stream}
              state={
                camera.status === 'error'
                  ? 'error'
                  : camera.status === 'ready' && tracker.status !== 'loading'
                    ? 'live'
                    : 'loading'
              }
              label="Your camera"
              mirror={settings.mirrorVideo}
              onVideoElement={attachVideo}
              overlay={{ frameRef: tracker.frameRef, show: settings.showLandmarks }}
              error={
                cameraError
                  ? {
                      ...cameraError,
                      actions: (
                        <>
                          <Button variant="primary" onClick={retry}>
                            Try again
                          </Button>
                          <Button onClick={() => settingsStore.update({ inputMode: 'keyboard' })}>
                            Use keyboard instead
                          </Button>
                        </>
                      ),
                    }
                  : undefined
              }
            />
          </div>
        </section>
      ) : (
        <section className={styles.keyboard} aria-labelledby="key-map">
          <h2 id="key-map" className="t-heading">
            Keys
          </h2>
          <p className="t-secondary">Hold a key for a quarter second to register its sign.</p>
          <KeyMap bindings={settings.keyBindings} />
        </section>
      )}

      <div>
        <Button variant="primary" size="lg" onClick={start} disabled={!canStart}>
          Start battle
        </Button>
      </div>
    </PageShell>
  );
}
