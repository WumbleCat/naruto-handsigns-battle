// MediaPipe Hand Landmarker wrapper (docs/DESIGN.md 7.2). Loads the WASM runtime and model
// lazily, runs detection on a requestAnimationFrame loop against a <video>, and publishes
// LandmarkFrames. The un-mirrored video is always what MediaPipe sees.
import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import {
  DetectorError,
  type DetectorStatus,
  type Handedness,
  type LandmarkFrame,
  type Unsubscribe,
} from './types';

/** Keep in step with the installed @mediapipe/tasks-vision version. */
export const MEDIAPIPE_VERSION = '1.2.2';
export const DEFAULT_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const DEFAULT_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export interface HandTrackerOptions {
  wasmBaseUrl?: string;
  modelUrl?: string;
  numHands?: number;
}

let landmarkerPromise: Promise<HandLandmarker> | null = null;

async function createLandmarker(options: Required<HandTrackerOptions>): Promise<HandLandmarker> {
  // Dynamic import keeps the MediaPipe runtime out of the main bundle until a camera page needs it.
  const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(options.wasmBaseUrl);
  const base = {
    runningMode: 'VIDEO' as const,
    numHands: options.numHands,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };
  try {
    return await HandLandmarker.createFromOptions(fileset, {
      ...base,
      baseOptions: { modelAssetPath: options.modelUrl, delegate: 'GPU' },
    });
  } catch {
    return HandLandmarker.createFromOptions(fileset, {
      ...base,
      baseOptions: { modelAssetPath: options.modelUrl, delegate: 'CPU' },
    });
  }
}

/** Loads (once per page) and caches the landmarker. Safe to call from several components. */
export function loadHandLandmarker(options: HandTrackerOptions = {}): Promise<HandLandmarker> {
  if (!landmarkerPromise) {
    const resolved: Required<HandTrackerOptions> = {
      wasmBaseUrl: options.wasmBaseUrl ?? DEFAULT_WASM_URL,
      modelUrl: options.modelUrl ?? DEFAULT_MODEL_URL,
      numHands: options.numHands ?? 2,
    };
    landmarkerPromise = createLandmarker(resolved).catch((error: unknown) => {
      landmarkerPromise = null;
      throw new DetectorError('model', 'Hand tracking could not load.', { cause: error });
    });
  }
  return landmarkerPromise;
}

export function toLandmarkFrame(
  result: HandLandmarkerResult,
  t: number,
  width: number,
  height: number,
): LandmarkFrame {
  const hands = result.landmarks.map((landmarks, index) => {
    const category = result.handedness[index]?.[0];
    const label: Handedness = category?.categoryName === 'Left' ? 'Left' : 'Right';
    return {
      handedness: label,
      score: category?.score ?? 0,
      landmarks: landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      worldLandmarks: (result.worldLandmarks[index] ?? []).map((p) => ({ x: p.x, y: p.y, z: p.z })),
    };
  });
  return { t, width, height, hands };
}

type FrameListener = (frame: LandmarkFrame) => void;
type StatusListener = (status: DetectorStatus) => void;

/** Runs hand tracking on a video element and publishes frames. One per camera view. */
export class HandTracker {
  status: DetectorStatus = 'idle';
  error: DetectorError | null = null;

  private readonly options: HandTrackerOptions;
  private landmarker: HandLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private rafId = 0;
  private lastVideoTime = -1;
  private lastTimestamp = 0;
  private readonly frameListeners = new Set<FrameListener>();
  private readonly statusListeners = new Set<StatusListener>();

  constructor(options: HandTrackerOptions = {}) {
    this.options = options;
  }

  onFrame(listener: FrameListener): Unsubscribe {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  onStatus(listener: StatusListener): Unsubscribe {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Loads the model if needed, then starts detecting on `video`. */
  async start(video: HTMLVideoElement): Promise<void> {
    this.video = video;
    if (!this.landmarker) {
      this.setStatus('loading');
      try {
        this.landmarker = await loadHandLandmarker(this.options);
      } catch (error) {
        this.error =
          error instanceof DetectorError
            ? error
            : new DetectorError('model', 'Hand tracking could not load.', { cause: error });
        this.setStatus('error');
        throw this.error;
      }
    }
    if (this.video !== video) return; // stopped or restarted while loading
    this.error = null;
    this.setStatus('ready');
    this.loop();
  }

  stop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.video = null;
    this.lastVideoTime = -1;
    if (this.status !== 'error') this.setStatus('idle');
  }

  private loop = (): void => {
    const video = this.video;
    const landmarker = this.landmarker;
    if (!video || !landmarker) return;
    if (video.readyState >= 2 && video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime;
      // detectForVideo needs strictly increasing timestamps.
      const now = Math.max(performance.now(), this.lastTimestamp + 1);
      this.lastTimestamp = now;
      try {
        const result = landmarker.detectForVideo(video, now);
        const frame = toLandmarkFrame(result, now, video.videoWidth, video.videoHeight);
        for (const listener of this.frameListeners) listener(frame);
      } catch (error) {
        this.error = new DetectorError('unknown', 'Hand tracking failed on a frame.', {
          cause: error,
        });
        this.setStatus('error');
        return;
      }
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private setStatus(status: DetectorStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }
}
