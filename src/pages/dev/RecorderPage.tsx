// Dev-only training data recorder (docs/DESIGN.md 7.6, docs/FRONTEND_DESIGN.md 6.13).
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/Button/Button';
import { Dialog } from '../../components/Dialog/Dialog';
import { PageShell, TopBar } from '../../components/PageShell/PageShell';
import { Seal } from '../../components/Seal/Seal';
import { Select } from '../../components/Select/Select';
import { TextField } from '../../components/TextField/TextField';
import { useToast } from '../../components/Toast/toastContext';
import { VideoPanel, type VideoPanelState } from '../../components/VideoPanel/VideoPanel';
import { CONTENT } from '../../content/content.config';
import type { LandmarkFrame } from '../../detection/types';
import { SIGN_IDS, type SignId } from '../../engine/types';
import { useCamera } from '../../features/camera/useCamera';
import { useHandTracker } from '../../features/camera/useHandTracker';
import {
  countByLabel,
  createRecording,
  createSignReferences,
  isUsableSample,
  parseRecording,
  SAMPLE_LABELS,
  type RecordingSample,
  type SampleLabel,
  type SignReference,
} from '../../features/recorder/recording';
import { downloadJson, readJsonFile } from '../../lib/download';
import { useSettings } from '../../lib/settings/store';
import styles from './RecorderPage.module.css';

type Phase =
  | { kind: 'idle' }
  | { kind: 'countdown'; remaining: number }
  | { kind: 'capturing'; captured: number; target: number };

interface Capture {
  label: SampleLabel;
  target: number;
  collected: RecordingSample[];
}

const COUNTDOWN_SECONDS = 3;

const LABEL_OPTIONS = SAMPLE_LABELS.map((label) => ({
  value: label,
  label: label === 'none' ? 'None (no sign, idle hands, transitions)' : CONTENT.signs[label].name,
}));

function cameraPanelState(status: string, trackerStatus: string): VideoPanelState {
  if (status === 'error') return 'error';
  if (status === 'ready' && trackerStatus !== 'loading') return 'live';
  return 'loading';
}

export function RecorderPage() {
  const settings = useSettings();
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { state: camera, retry } = useCamera({ deviceId: settings.cameraDeviceId, enabled: true });
  const stream = camera.status === 'ready' ? camera.stream : null;
  const tracker = useHandTracker(videoRef, stream, true);

  const [label, setLabel] = useState<SampleLabel>('tiger');
  const [perCapture, setPerCapture] = useState(100);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [samples, setSamples] = useState<RecordingSample[]>([]);
  const [captures, setCaptures] = useState<Array<{ label: SampleLabel; count: number }>>([]);
  const [references, setReferences] = useState<Partial<Record<SignId, SignReference>>>({});
  const [handsVisible, setHandsVisible] = useState(0);
  const [clearOpen, setClearOpen] = useState(false);
  const captureRef = useRef<Capture | null>(null);
  const sessionId = useRef<string>(crypto.randomUUID());

  const attachVideo = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
  }, []);

  // Collect samples straight from the tracker while a capture is running.
  useEffect(() => {
    return tracker.subscribe((frame: LandmarkFrame) => {
      setHandsVisible((current) => (current === frame.hands.length ? current : frame.hands.length));
      const capture = captureRef.current;
      if (!capture || !isUsableSample(capture.label, frame.hands)) return;
      capture.collected.push({ label: capture.label, t: frame.t, hands: frame.hands });
      const captured = capture.collected.length;
      if (captured >= capture.target) {
        captureRef.current = null;
        setSamples((current) => [...current, ...capture.collected]);
        setCaptures((current) => [...current, { label: capture.label, count: captured }]);
        setPhase({ kind: 'idle' });
      } else {
        setPhase({ kind: 'capturing', captured, target: capture.target });
      }
    });
  }, [tracker]);

  const startCapture = () => {
    const run = (remaining: number) => {
      if (remaining === 0) {
        captureRef.current = { label, target: perCapture, collected: [] };
        setPhase({ kind: 'capturing', captured: 0, target: perCapture });
        return;
      }
      setPhase({ kind: 'countdown', remaining });
      window.setTimeout(() => run(remaining - 1), 1000);
    };
    run(COUNTDOWN_SECONDS);
  };

  const cancelCapture = () => {
    captureRef.current = null;
    setPhase({ kind: 'idle' });
  };

  const undoLast = () => {
    const last = captures.at(-1);
    if (!last) return;
    setSamples((current) => current.slice(0, current.length - last.count));
    setCaptures((current) => current.slice(0, -1));
  };

  const clearSession = () => {
    setSamples([]);
    setCaptures([]);
    setClearOpen(false);
  };

  const exportSession = () => {
    const video = videoRef.current;
    downloadJson(
      `recording-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      createRecording(
        {
          sessionId: sessionId.current,
          recordedAt: new Date().toISOString(),
          device: {
            userAgent: navigator.userAgent,
            videoWidth: video?.videoWidth ?? 0,
            videoHeight: video?.videoHeight ?? 0,
            mirror: settings.mirrorVideo,
          },
        },
        samples,
      ),
    );
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = parseRecording(await readJsonFile(file));
      setSamples((current) => [...current, ...parsed.samples]);
      setCaptures((current) => [...current, { label: 'none', count: parsed.samples.length }]);
      toast.show({ message: `Imported ${parsed.samples.length} samples.`, tone: 'ok' });
    } catch (error) {
      toast.show({
        message: error instanceof Error ? error.message : 'Import failed.',
        tone: 'danger',
      });
    }
  };

  const saveReference = () => {
    const frame = tracker.frameRef.current;
    if (label === 'none' || !frame || frame.hands.length === 0) {
      toast.show({ message: 'Hold the sign with your hands in view first.', tone: 'danger' });
      return;
    }
    setReferences((current) => ({
      ...current,
      [label]: { width: frame.width, height: frame.height, hands: frame.hands },
    }));
    toast.show({ message: `Saved a reference for ${CONTENT.signs[label].name}.`, tone: 'ok' });
  };

  const exportReferences = () => {
    downloadJson('sign-references.json', createSignReferences(references));
  };

  const counts = countByLabel(samples);
  const panelState = cameraPanelState(camera.status, tracker.status);
  const busy = phase.kind !== 'idle';

  return (
    <>
      <TopBar
        brand={<Link to="/">{CONTENT.game.title}</Link>}
        end={<span className="t-small t-muted">Recorder (dev only)</span>}
      />
      <PageShell wide>
        <h1 className="t-display-md">Recorder</h1>
        <div className={styles.layout}>
          <div className={styles.stage}>
            <VideoPanel
              stream={stream}
              state={panelState}
              label="Your camera"
              mirror={settings.mirrorVideo}
              onVideoElement={attachVideo}
              overlay={{ frameRef: tracker.frameRef, show: true }}
              error={
                camera.status === 'error'
                  ? {
                      title: 'Camera unavailable',
                      body: camera.error.message,
                      actions: <Button onClick={retry}>Try again</Button>,
                    }
                  : tracker.status === 'error'
                    ? {
                        title: 'Hand tracking could not load',
                        body: tracker.error?.message ?? 'Check your connection and reload.',
                      }
                    : undefined
              }
            >
              {phase.kind === 'countdown' ? (
                <span className={`t-display-lg ${styles.countdown}`}>{phase.remaining}</span>
              ) : null}
            </VideoPanel>

            <dl className={styles.status}>
              <div>
                <dt>Camera</dt>
                <dd>{camera.status}</dd>
              </div>
              <div>
                <dt>Tracking</dt>
                <dd>{tracker.status}</dd>
              </div>
              <div>
                <dt>Hands in view</dt>
                <dd>{handsVisible}</dd>
              </div>
              <div>
                <dt>Classifier</dt>
                <dd>none loaded (v0.6.0)</dd>
              </div>
            </dl>
          </div>

          <div className={styles.controls}>
            <Select
              label="Label"
              options={LABEL_OPTIONS}
              value={label}
              onChange={(event) => setLabel(event.target.value as SampleLabel)}
              disabled={busy}
            />
            <TextField
              label="Samples per capture"
              type="number"
              min={10}
              max={1000}
              value={perCapture}
              onChange={(event) => setPerCapture(Math.max(10, Number(event.target.value) || 10))}
              disabled={busy}
              helper="Move and rotate your hands slightly while capturing."
            />
            <div className={styles.actions}>
              {phase.kind === 'idle' ? (
                <Button variant="primary" onClick={startCapture} disabled={panelState !== 'live'}>
                  Start capture
                </Button>
              ) : (
                <Button variant="danger" onClick={cancelCapture}>
                  Cancel
                </Button>
              )}
              <Button onClick={saveReference} disabled={busy || label === 'none'}>
                Save as reference
              </Button>
            </div>
            {phase.kind === 'capturing' ? (
              <p className={styles.progress} aria-live="polite">
                Capturing {phase.captured} of {phase.target}
              </p>
            ) : null}

            <section className={styles.session} aria-labelledby="session-heading">
              <h2 id="session-heading" className="t-heading">
                Session
              </h2>
              <ul className={styles.counts}>
                {SAMPLE_LABELS.map((item) => (
                  <li
                    key={item}
                    className={styles.countRow}
                    data-empty={counts[item] === 0 || undefined}
                  >
                    {item === 'none' ? (
                      <Seal size={24} variant="empty" decorative />
                    ) : (
                      <Seal sign={item} size={24} decorative />
                    )}
                    <span className={styles.countLabel}>
                      {item === 'none' ? 'None' : CONTENT.signs[item].name}
                    </span>
                    <span className={styles.countValue}>{counts[item]}</span>
                  </li>
                ))}
              </ul>
              <p className="t-small t-muted">
                {samples.length} samples in {captures.length} captures. References saved:{' '}
                {Object.keys(references).length} of {SIGN_IDS.length}.
              </p>
              <div className={styles.actions}>
                <Button onClick={undoLast} disabled={captures.length === 0 || busy}>
                  Undo last
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setClearOpen(true)}
                  disabled={samples.length === 0 || busy}
                >
                  Clear session
                </Button>
              </div>
              <div className={styles.actions}>
                <Button variant="primary" onClick={exportSession} disabled={samples.length === 0}>
                  Export JSON
                </Button>
                <label className={styles.importLabel}>
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => void importFile(event)}
                    className="visually-hidden"
                  />
                  <span className={styles.importButton}>Import</span>
                </label>
                <Button onClick={exportReferences} disabled={Object.keys(references).length === 0}>
                  Export references
                </Button>
              </div>
            </section>
          </div>
        </div>
      </PageShell>

      <Dialog
        open={clearOpen}
        title="Clear this session?"
        destructive
        onClose={() => setClearOpen(false)}
        actions={
          <>
            <Button onClick={() => setClearOpen(false)}>Keep</Button>
            <Button variant="danger" onClick={clearSession}>
              Clear {samples.length} samples
            </Button>
          </>
        }
      >
        Samples that have not been exported are lost.
      </Dialog>
    </>
  );
}
