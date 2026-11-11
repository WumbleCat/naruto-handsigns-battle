// Practice one jutsu (docs/FRONTEND_DESIGN.md 6.7): camera on the left, the sequence on the
// right, each sign stamping as it registers, with time, best, attempts and completions.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { Button } from '../components/Button/Button';
import { LinkButton } from '../components/Button/LinkButton';
import { DetectionReadout } from '../components/DetectionReadout/DetectionReadout';
import { PageShell } from '../components/PageShell/PageShell';
import { Seal } from '../components/Seal/Seal';
import { Spinner } from '../components/Spinner/Spinner';
import { VideoPanel } from '../components/VideoPanel/VideoPanel';
import { BALANCE } from '../content/balance.config';
import { CONTENT } from '../content/content.config';
import { isRosterJutsuId, ROSTER_BY_ID, type RosterJutsuDef } from '../content/roster';
import { createSignDetector } from '../detection/createDetector';
import { modelStore, useModelState } from '../detection/model';
import type { SignId } from '../engine/types';
import { useFrameTick } from '../features/battle/hooks';
import { KeyMap } from '../features/battle/KeyMap';
import { useCamera } from '../features/camera/useCamera';
import { useHandTracker } from '../features/camera/useHandTracker';
import { damageOf } from '../features/jutsu/damageOf';
import { PracticeInput } from '../features/practice/PracticeInput';
import { PracticeTracker } from '../features/practice/PracticeTracker';
import { useSettings } from '../lib/settings/store';
import styles from './PracticeJutsuPage.module.css';

const MISS_FLASH_MS = 300;
const COMPLETE_STAMP_MS = 1200;

function formatSeconds(ms: number | null): string {
  return ms === null ? '–' : `${(ms / 1000).toFixed(1)} s`;
}

export function PracticeJutsuPage() {
  const { jutsuId } = useParams();
  const settings = useSettings();
  const model = useModelState();
  const free = jutsuId === 'free';
  const jutsu = !free && isRosterJutsuId(jutsuId) ? ROSTER_BY_ID[jutsuId] : null;

  useEffect(() => {
    if (model.status === 'unknown') void modelStore.load();
  }, [model.status]);

  if (!free && !jutsu) return <Navigate to="/practice" replace />;
  // The session picks its detector once, so wait until we know whether the model exists.
  if (
    settings.inputMode === 'webcam' &&
    (model.status === 'unknown' || model.status === 'loading')
  ) {
    return (
      <PageShell wide centered>
        <Spinner label="Loading the recognition model" />
      </PageShell>
    );
  }
  return <PracticeSession key={jutsuId} jutsu={jutsu} modelReady={model.status === 'available'} />;
}

function PracticeSession({
  jutsu,
  modelReady,
}: {
  jutsu: RosterJutsuDef | null;
  modelReady: boolean;
}) {
  const settings = useSettings();
  const fellBackToKeyboard = settings.inputMode === 'webcam' && !modelReady;
  const inputMode = fellBackToKeyboard ? 'keyboard' : settings.inputMode;

  const [input] = useState(
    () =>
      new PracticeInput({
        detector: createSignDetector(inputMode, settings),
        tracker: jutsu
          ? new PracticeTracker(jutsu.sequence, { resetMs: BALANCE.bufferResetMs })
          : null,
        holdMs: BALANCE.signHoldMs,
        threshold: settings.confidenceThreshold,
      }),
  );
  const frame = useFrameTick(true);
  const [missAt, setMissAt] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [, setVersion] = useState(0);

  useEffect(() => {
    input.start().catch(() => undefined);
    const off = input.onEvent((event) => {
      setVersion((n) => n + 1);
      if (event.type === 'miss') {
        setMissAt(input.tracker?.getProgress() ?? 0);
        window.setTimeout(() => setMissAt(null), MISS_FLASH_MS);
      }
      if (event.type === 'complete') {
        setCompleted(true);
        window.setTimeout(() => setCompleted(false), COMPLETE_STAMP_MS);
      }
    });
    return () => {
      off();
      input.stop();
    };
  }, [input]);

  useEffect(() => {
    input.tick(frame.now);
  }, [input, frame.now]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attachVideo = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
  }, []);
  // Keyboard mode never asks for the camera: the sign pad takes its place.
  const webcam = inputMode === 'webcam';
  const { state: camera } = useCamera({ deviceId: settings.cameraDeviceId, enabled: webcam });
  const stream = camera.status === 'ready' ? camera.stream : null;
  const tracker = useHandTracker(videoRef, stream, camera.status === 'ready');

  // On-screen sign buttons hold and release through the keyboard detector.
  const padHold = useCallback(
    (sign: SignId) => {
      const detector = input.detector;
      if (detector.kind === 'keyboard') detector.hold(sign);
    },
    [input],
  );
  const padRelease = useCallback(
    (sign: SignId) => {
      const detector = input.detector;
      if (detector.kind === 'keyboard') detector.release(sign);
    },
    [input],
  );

  // In webcam mode the detector classifies the frames this page's tracker produces.
  useEffect(() => {
    const detector = input.detector;
    if (detector.kind !== 'ml') return;
    detector.setFrameSource(tracker.subscribe);
    return () => detector.setFrameSource(null);
  }, [input, tracker.subscribe]);

  const hold = input.getHold(frame.now);
  const progress = input.tracker?.getProgress() ?? 0;
  const stats = input.tracker?.getStats();
  const elapsed = input.tracker?.elapsed(frame.now) ?? null;
  const name = jutsu ? CONTENT.jutsus[jutsu.id].name : 'Free practice';
  const element = jutsu ? (jutsu.element ?? 'substitution') : null;
  const damage = jutsu ? damageOf(jutsu) : null;

  return (
    <PageShell wide>
      <header className={styles.header}>
        <h1 className="t-display-md">{name}</h1>
        {jutsu ? (
          <p className="t-secondary">
            {element ? CONTENT.elements[element].name : ''}, {jutsu.sequence.length}{' '}
            {CONTENT.terms.signPlural}
            {damage !== null ? `, ${damage} damage` : ''}
          </p>
        ) : (
          <p className="t-secondary">What the camera reads right now, with no target.</p>
        )}
      </header>

      {fellBackToKeyboard ? (
        <p className={styles.note}>
          No recognition model is installed yet, so this session uses the keyboard.
        </p>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.stage}>
          <VideoPanel
            stream={stream}
            state={
              !webcam
                ? 'no-stream'
                : camera.status === 'error'
                  ? 'error'
                  : camera.status === 'ready'
                    ? 'live'
                    : 'loading'
            }
            label="Your camera"
            mirror={settings.mirrorVideo}
            onVideoElement={attachVideo}
            overlay={{ frameRef: tracker.frameRef, show: settings.showLandmarks }}
            avatar={
              <p className="t-secondary">
                Keyboard mode: the camera stays off. Press keys or click the signs.
              </p>
            }
            error={{
              title: 'Camera unavailable',
              body: camera.status === 'error' ? camera.error.message : '',
            }}
          >
            <DetectionReadout
              sign={hold.sign}
              confidence={hold.confidence}
              holdFraction={hold.fraction}
              idleText={inputMode === 'keyboard' ? 'Hold a key' : 'No sign'}
              note={
                inputMode === 'webcam' && tracker.status !== 'ready'
                  ? tracker.status === 'error'
                    ? 'Hand tracking stopped'
                    : 'Loading hand tracking'
                  : undefined
              }
            />
          </VideoPanel>
          {completed && jutsu ? (
            <div className={styles.stamp} role="status">
              <span className={`t-display-lg ${styles.stampWord}`} data-element={element}>
                {name}
              </span>
            </div>
          ) : null}
          {inputMode === 'keyboard' ? (
            <KeyMap
              bindings={settings.keyBindings}
              held={hold.sign}
              compact
              holdMs={BALANCE.signHoldMs}
              onHold={padHold}
              onRelease={padRelease}
            />
          ) : null}
        </div>

        <aside className={styles.side}>
          {jutsu ? (
            <>
              <h2 className="t-heading">Sequence</h2>
              <ol className={styles.sequence} aria-label={`${name} sequence`}>
                {jutsu.sequence.map((sign, index) => {
                  const done = index < progress;
                  const current = index === progress;
                  return (
                    <li
                      key={`${sign}-${index}`}
                      className={styles.step}
                      data-state={done ? 'done' : current ? 'current' : 'todo'}
                      data-miss={missAt === index || undefined}
                    >
                      <Seal
                        sign={sign}
                        tint={element ?? undefined}
                        size={32}
                        variant={done ? 'stamped' : current ? 'ring' : 'outline'}
                        progress={current && hold.sign === sign ? hold.fraction : 0}
                        decorative
                      />
                      <span className={styles.stepName}>{CONTENT.signs[sign].name}</span>
                      {current ? <span className={styles.now}>now</span> : null}
                    </li>
                  );
                })}
              </ol>
              <dl className={styles.stats}>
                <div>
                  <dt>Time</dt>
                  <dd>{formatSeconds(elapsed)}</dd>
                </div>
                <div>
                  <dt>Best</dt>
                  <dd>{formatSeconds(stats?.bestMs ?? null)}</dd>
                </div>
                <div>
                  <dt>Attempts</dt>
                  <dd>{stats?.attempts ?? 0}</dd>
                </div>
                <div>
                  <dt>Completed</dt>
                  <dd>{stats?.completed ?? 0}</dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <h2 className="t-heading">Last registered</h2>
              <p className="t-secondary">
                {input.getLastRegistered()
                  ? CONTENT.signs[
                      input.getLastRegistered() as NonNullable<
                        ReturnType<typeof input.getLastRegistered>
                      >
                    ].name
                  : 'Nothing yet. Hold a sign.'}
              </p>
            </>
          )}
          <div className={styles.actions}>
            {jutsu ? <Button onClick={() => input.restart()}>Restart</Button> : null}
            <LinkButton to="/practice" variant="ghost">
              Pick another jutsu
            </LinkButton>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
