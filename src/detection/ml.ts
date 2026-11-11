// The webcam detector (docs/DESIGN.md 7.4 and 7.5): landmark frames from a HandTracker ->
// hands-v1 features -> MLP probabilities -> exponential moving average -> SignFrame.
// The stabiliser downstream applies the hold time and the confidence threshold.
import { isSignId, type SignId } from '../engine/types';
import { argmax, type SignClassifier } from './classifier';
import { extractFeatures } from './features';
import type {
  DetectorError,
  DetectorStatus,
  LandmarkFrame,
  SignDetector,
  SignFrame,
  Unsubscribe,
} from './types';

export type FrameSource = (listener: (frame: LandmarkFrame) => void) => Unsubscribe;

export interface MlSignDetectorOptions {
  classifier: SignClassifier;
  /** Weight of the newest frame in the moving average, 0..1. */
  smoothingAlpha: number;
  /** Label used by the model for "no sign". */
  noneLabel?: string;
}

export class MlSignDetector implements SignDetector {
  readonly kind = 'ml' as const;
  status: DetectorStatus = 'idle';
  readonly error: DetectorError | null = null;

  private readonly classifier: SignClassifier;
  private readonly alpha: number;
  private readonly noneIndex: number;
  private readonly signByIndex: Array<SignId | 'none'>;
  private source: FrameSource | null = null;
  private offSource: Unsubscribe | null = null;
  private started = false;
  private ema: Float32Array | null = null;
  private readonly frameListeners = new Set<(frame: SignFrame) => void>();
  private readonly statusListeners = new Set<(status: DetectorStatus) => void>();

  constructor(options: MlSignDetectorOptions) {
    this.classifier = options.classifier;
    this.alpha = Math.max(0, Math.min(1, options.smoothingAlpha));
    const noneLabel = options.noneLabel ?? 'none';
    this.noneIndex = Math.max(0, options.classifier.labels.indexOf(noneLabel));
    this.signByIndex = options.classifier.labels.map((label) => (isSignId(label) ? label : 'none'));
  }

  /** Where landmark frames come from (a HandTracker's subscribe). Can be set before or after start. */
  setFrameSource(source: FrameSource | null): void {
    this.offSource?.();
    this.offSource = null;
    this.source = source;
    this.ema = null;
    if (this.started && source) {
      this.offSource = source(this.onLandmarks);
      this.setStatus('ready');
    } else if (this.started) {
      this.setStatus('loading');
    }
  }

  onFrame(listener: (frame: SignFrame) => void): Unsubscribe {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  onStatus(listener: (status: DetectorStatus) => void): Unsubscribe {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  start(): Promise<void> {
    if (this.started) return Promise.resolve();
    this.started = true;
    if (this.source) {
      this.offSource = this.source(this.onLandmarks);
      this.setStatus('ready');
    } else {
      this.setStatus('loading');
    }
    return Promise.resolve();
  }

  stop(): void {
    this.offSource?.();
    this.offSource = null;
    this.started = false;
    this.ema = null;
    this.setStatus('idle');
  }

  /** Classify one landmark frame. Public so the recorder can show live predictions. */
  classify(frame: LandmarkFrame): SignFrame {
    if (frame.hands.length === 0) {
      this.ema = null;
      return { t: frame.t, sign: 'none', confidence: 1 };
    }
    const aspect = frame.height > 0 ? frame.width / frame.height : 16 / 9;
    const probabilities = this.classifier.predict(extractFeatures(frame.hands, aspect));
    if (!this.ema || this.ema.length !== probabilities.length) {
      this.ema = Float32Array.from(probabilities);
    } else {
      for (let i = 0; i < probabilities.length; i += 1) {
        this.ema[i] = (this.ema[i] ?? 0) * (1 - this.alpha) + (probabilities[i] ?? 0) * this.alpha;
      }
    }
    const best = argmax(this.ema);
    const sign = best === this.noneIndex ? 'none' : (this.signByIndex[best] ?? 'none');
    return {
      t: frame.t,
      sign,
      confidence: this.ema[best] ?? 0,
      probabilities: Float32Array.from(this.ema),
    };
  }

  private onLandmarks = (frame: LandmarkFrame): void => {
    if (!this.started) return;
    const result = this.classify(frame);
    for (const listener of this.frameListeners) listener(result);
  };

  private setStatus(status: DetectorStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }
}
