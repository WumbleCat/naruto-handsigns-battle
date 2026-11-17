// Webcam hand signs for the duel: the page's camera and hand tracker feed the trained model
// through WebcamSignSource. Nothing from the camera leaves the browser; only accepted signs
// are sent, and only by the caller's `onSign`.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DUEL_CONFIG } from '@jutsu-duel/duel-shared';
import type { DuelSign } from '@jutsu-duel/duel-shared';
import { BALANCE } from '../../content/balance.config';
import { modelStore, useModelState } from '../../detection/model';
import { useCamera, type CameraState } from '../../features/camera/useCamera';
import { useHandTracker, type HandTrackerHandle } from '../../features/camera/useHandTracker';
import { useSettings } from '../../lib/settings/store';
import { WebcamSignSource, type SignObservation } from './signSource';

export interface WebcamSignsHandle {
  enabled: boolean;
  camera: CameraState;
  stream: MediaStream | null;
  tracker: HandTrackerHandle;
  attachVideo: (element: HTMLVideoElement | null) => void;
  mirror: boolean;
  showLandmarks: boolean;
  /** One line for the HUD: what the pipeline is doing right now. */
  status: string;
  ready: boolean;
  hold: (nowMs: number) => { sign: DuelSign | null; fraction: number; confidence: number };
}

export function useWebcamSigns(
  enabled: boolean,
  onSign: (observation: SignObservation) => void,
): WebcamSignsHandle {
  const settings = useSettings();
  const model = useModelState();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attachVideo = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
  }, []);
  const { state: camera } = useCamera({ deviceId: settings.cameraDeviceId, enabled });
  const stream = camera.status === 'ready' ? camera.stream : null;
  const tracker = useHandTracker(videoRef, stream, enabled && camera.status === 'ready');
  const [source, setSource] = useState<WebcamSignSource | null>(null);
  const latestOnSign = useRef(onSign);

  useEffect(() => {
    latestOnSign.current = onSign;
  }, [onSign]);

  useEffect(() => {
    if (enabled && model.status === 'unknown') void modelStore.load();
  }, [enabled, model.status]);

  const classifier = model.status === 'available' ? model.classifier : null;

  useEffect(() => {
    if (!enabled || !classifier) return;
    const created = new WebcamSignSource({
      classifier,
      subscribe: tracker.subscribe,
      smoothingAlpha: BALANCE.smoothingAlpha,
      holdMs: DUEL_CONFIG.signs.holdMs,
      minConfidence: DUEL_CONFIG.signs.minConfidence,
    });
    const off = created.onSign((observation) => latestOnSign.current(observation));
    created.start();
    // The source is created in an effect, so the state update happens outside render.
    queueMicrotask(() => setSource(created));
    return () => {
      off();
      created.stop();
      queueMicrotask(() => setSource((current) => (current === created ? null : current)));
    };
  }, [enabled, classifier, tracker.subscribe]);

  const status = !enabled
    ? 'Webcam signs off'
    : model.status === 'missing'
      ? 'No recognition model installed'
      : model.status === 'error'
        ? 'The recognition model failed to load'
        : camera.status === 'error'
          ? `Camera: ${camera.error.message}`
          : camera.status !== 'ready'
            ? 'Waiting for the camera'
            : tracker.status === 'error'
              ? 'Hand tracking failed to load'
              : tracker.status !== 'ready'
                ? 'Loading hand tracking'
                : source
                  ? 'Webcam signs live'
                  : 'Starting the classifier';

  const ready = enabled && source !== null && tracker.status === 'ready';
  const hold = useMemo(
    () => (nowMs: number) => source?.hold(nowMs) ?? { sign: null, fraction: 0, confidence: 0 },
    [source],
  );

  return {
    enabled,
    camera,
    stream,
    tracker,
    attachVideo,
    mirror: settings.mirrorVideo,
    showLandmarks: settings.showLandmarks,
    status,
    ready,
    hold,
  };
}
