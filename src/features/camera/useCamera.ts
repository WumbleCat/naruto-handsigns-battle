import { useCallback, useEffect, useState } from 'react';
import { CameraError, openCamera, stopStream, toCameraError } from '../../detection/camera';

export type CameraState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'ready'; stream: MediaStream }
  | { status: 'error'; error: CameraError };

const IDLE: CameraState = { status: 'idle' };

/**
 * Owns one camera stream: opens it when enabled, stops it on unmount or device change,
 * reports a typed error when it fails or the device disappears.
 */
export function useCamera(options: { deviceId: string | null; enabled: boolean }): {
  state: CameraState;
  retry: () => void;
} {
  const { deviceId, enabled } = options;
  const [state, setState] = useState<CameraState>(IDLE);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stream: MediaStream | null = null;

    void Promise.resolve().then(() => {
      if (!cancelled) setState({ status: 'requesting' });
    });

    openCamera(deviceId)
      .then((opened) => {
        if (cancelled) {
          stopStream(opened);
          return;
        }
        stream = opened;
        const [track] = opened.getVideoTracks();
        track?.addEventListener('ended', () => {
          if (!cancelled) {
            setState({ status: 'error', error: new CameraError('ended', 'Camera disconnected.') });
          }
        });
        setState({ status: 'ready', stream: opened });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', error: toCameraError(error) });
      });

    return () => {
      cancelled = true;
      stopStream(stream);
    };
  }, [deviceId, enabled, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { state: enabled ? state : IDLE, retry };
}
