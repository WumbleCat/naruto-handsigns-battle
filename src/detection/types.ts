// Detection layer contracts (docs/DESIGN.md section 7).
import type { SignFrame } from '../engine/stabilizer';

export type { SignFrame };

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export type Handedness = 'Left' | 'Right';

/** One tracked hand: 21 landmarks in normalised image space plus metric world landmarks. */
export interface HandLandmarks {
  handedness: Handedness;
  score: number;
  landmarks: Point3[];
  worldLandmarks: Point3[];
}

/** One frame of hand tracking. `hands` is empty when nothing is detected. */
export interface LandmarkFrame {
  t: number;
  width: number;
  height: number;
  hands: HandLandmarks[];
}

export type DetectorKind = 'keyboard' | 'ml';
export type DetectorStatus = 'idle' | 'loading' | 'ready' | 'error';

export type DetectorErrorCode = 'camera' | 'model' | 'unsupported' | 'unknown';

export class DetectorError extends Error {
  readonly code: DetectorErrorCode;

  constructor(code: DetectorErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DetectorError';
    this.code = code;
  }
}

export type Unsubscribe = () => void;

/** Anything that produces per-frame sign predictions: keyboard now, MediaPipe + classifier later. */
export interface SignDetector {
  readonly kind: DetectorKind;
  readonly status: DetectorStatus;
  readonly error: DetectorError | null;
  start(): Promise<void>;
  stop(): void;
  onFrame(listener: (frame: SignFrame) => void): Unsubscribe;
  onStatus(listener: (status: DetectorStatus) => void): Unsubscribe;
}
