// Pre-battle: difficulty, input mode and the camera check (docs/FRONTEND_DESIGN.md 6.4).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/Button/Button';
import { LinkButton } from '../components/Button/LinkButton';
import { DetectionReadout } from '../components/DetectionReadout/DetectionReadout';
import { PageShell } from '../components/PageShell/PageShell';
import { SegmentedControl } from '../components/SegmentedControl/SegmentedControl';
import { Spinner } from '../components/Spinner/Spinner';
import { VideoPanel } from '../components/VideoPanel/VideoPanel';
import { BALANCE } from '../content/balance.config';
import { CONTENT } from '../content/content.config';
import { BOT_DIFFICULTIES, type BotDifficulty } from '../content/types';
import { NO_MODEL_MESSAGE } from '../detection/createDetector';
import { MlSignDetector } from '../detection/ml';
import { modelStore, useModelState } from '../detection/model';
import type { SignId } from '../engine/types';
import { useBattleSession } from '../features/battle/battleSessionContext';
import { useFrameTick } from '../features/battle/hooks';
import { BotAvatar } from '../features/battle/hud/BotAvatar';
import { KeyMap } from '../features/battle/KeyMap';
import { useCamera } from '../features/camera/useCamera';
import { useHandTracker } from '../features/camera/useHandTracker';
import { PracticeInput } from '../features/practice/PracticeInput';
import { INPUT_MODES, type InputMode } from '../lib/settings/schema';
import { settingsStore, useSettings } from '../lib/settings/store';
import styles from './PlayPage.module.css';

const INPUT_OPTIONS: readonly { value: InputMode; label: string }[] = INPUT_MODES.map((value) => ({
  value,
  label: value === 'webcam' ? 'Webcam' : 'Keyboard',
}));

/** The sign the player holds to prove the whole pipeline before a fight. */
const CONFIRM_SIGN: SignId = 'ram';

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
  const model = useModelState();
  const [difficulty, setDifficulty] = useState<BotDifficulty>(
    session.setup?.difficulty ?? 'medium',
  );
  const inputMode = settings.inputMode;
  const webcam = inputMode === 'webcam';

  useEffect(() => {
    if (model.status === 'unknown') void modelStore.load();
  }, [model.status]);

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

  // The confirmation check runs the real detector and stabiliser on the preview, so a
  // registered Ram sign means the camera, tracking, model and hold rule all work together.
  const classifier = model.status === 'available' ? model.classifier : null;
  const confirm = useMemo(
    () =>
      classifier
        ? new PracticeInput({
            detector: new MlSignDetector({ classifier, smoothingAlpha: BALANCE.smoothingAlpha }),
            tracker: null,
            holdMs: BALANCE.signHoldMs,
            threshold: settings.confidenceThreshold,
          })
        : null,
    [classifier, settings.confidenceThreshold],
  );
  const [confirmed, setConfirmed] = useState(false);
  const confirming = webcam && confirm !== null && tracker.status === 'ready';

  useEffect(() => {
    if (!confirming) return;
    const off = confirm.onEvent((event) => {
      if (event.type === 'registered' && event.sign === CONFIRM_SIGN) setConfirmed(true);
    });
    confirm.detector.setFrameSource(tracker.subscribe);
    confirm.start().catch(() => undefined);
    return () => {
      off();
      confirm.stop();
      confirm.detector.setFrameSource(null);
    };
  }, [confirming, confirm, tracker.subscribe]);

  const clock = useFrameTick(confirming);
  const hold = confirming ? confirm.getHold(clock.now) : null;

  const cameraCheck: CheckState =
    camera.status === 'ready' ? 'ok' : camera.status === 'error' ? 'error' : 'pending';
  const trackingCheck: CheckState =
    tracker.status === 'ready' ? 'ok' : tracker.status === 'error' ? 'error' : 'pending';
  const modelCheck: CheckState =
    model.status === 'available'
      ? confirmed
        ? 'ok'
        : 'pending'
      : model.status === 'missing'
        ? 'warn'
        : model.status === 'error'
          ? 'error'
          : 'pending';
  const modelText =
    model.status === 'available'
      ? confirmed
        ? `${CONTENT.signs[CONFIRM_SIGN].name} sign recognised`
        : `Hold the ${CONTENT.signs[CONFIRM_SIGN].name} sign to confirm`
      : model.status === 'missing'
        ? NO_MODEL_MESSAGE
        : model.status === 'error'
          ? `The recognition model could not load. ${model.message}`
          : 'Loading the recognition model';

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
                {tracker.status === 'ready'
                  ? 'Hand tracking loaded'
                  : tracker.status === 'error'
                    ? 'Hand tracking could not load'
                    : 'Loading hand tracking'}
              </Check>
              <Check state={modelCheck}>{modelText}</Check>
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
            >
              {hold ? (
                <DetectionReadout
                  sign={hold.sign}
                  confidence={hold.confidence}
                  holdFraction={hold.fraction}
                  idleText="No sign"
                />
              ) : null}
            </VideoPanel>
          </div>
        </section>
      ) : (
        <section className={styles.keyboard} aria-labelledby="key-map">
          <h2 id="key-map" className="t-heading">
            Keys
          </h2>
          <p className="t-secondary">
            Hold a key for a quarter second to register its sign. On the stage you can also click
            the signs; the camera stays off.
          </p>
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
