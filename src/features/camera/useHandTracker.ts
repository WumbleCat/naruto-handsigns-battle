import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { HandTracker } from '../../detection/mediapipe';
import type { DetectorError, DetectorStatus, LandmarkFrame } from '../../detection/types';

type FrameListener = (frame: LandmarkFrame) => void;

export interface HandTrackerHandle {
  status: DetectorStatus;
  error: DetectorError | null;
  /** Latest frame, updated outside React's render cycle for overlays and capture loops. */
  frameRef: RefObject<LandmarkFrame | null>;
  subscribe: (listener: FrameListener) => () => void;
}

/**
 * Runs MediaPipe hand tracking on the video element once a stream is attached. Frames are
 * delivered through a ref and subscriptions, not state, so 30 fps never re-renders the page.
 */
export function useHandTracker(
  videoRef: RefObject<HTMLVideoElement | null>,
  stream: MediaStream | null,
  enabled: boolean,
): HandTrackerHandle {
  const trackerRef = useRef<HandTracker | null>(null);
  const frameRef = useRef<LandmarkFrame | null>(null);
  const listeners = useRef(new Set<FrameListener>());
  const [status, setStatus] = useState<DetectorStatus>('idle');
  const [error, setError] = useState<DetectorError | null>(null);

  useEffect(() => {
    if (!enabled || !stream) return;
    const video = videoRef.current;
    if (!video) return;

    const wasmBaseUrl = import.meta.env.VITE_MEDIAPIPE_WASM_URL || undefined;
    trackerRef.current ??= new HandTracker(wasmBaseUrl ? { wasmBaseUrl } : {});
    const tracker = trackerRef.current;

    const offStatus = tracker.onStatus((next) => {
      setStatus(next);
      setError(tracker.error);
    });
    const offFrame = tracker.onFrame((frame) => {
      frameRef.current = frame;
      for (const listener of listeners.current) listener(frame);
    });

    const begin = () => {
      tracker.start(video).catch(() => undefined);
    };
    if (video.readyState >= 2) begin();
    else video.addEventListener('loadeddata', begin, { once: true });

    return () => {
      video.removeEventListener('loadeddata', begin);
      tracker.stop();
      offStatus();
      offFrame();
      frameRef.current = null;
    };
  }, [videoRef, stream, enabled]);

  const subscribe = useCallback((listener: FrameListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  return { status, error, frameRef, subscribe };
}
