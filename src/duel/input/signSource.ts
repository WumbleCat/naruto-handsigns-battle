// Where duel signs come from. The spec's GestureRecognizer is a frame-polling interface; this
// project's recognition pipeline is event-driven (tracker frames -> classifier -> stabiliser ->
// registered sign), so the adapter boundary is an event source with the same swap-ability:
// combat code only ever sees `onSign`.
import { isDuelSign, type DuelSign } from '@jutsu-duel/duel-shared';
import type { SignClassifier } from '../../detection/classifier';
import { MlSignDetector } from '../../detection/ml';
import type { LandmarkFrame, Unsubscribe } from '../../detection/types';
import { SignStabilizer } from '../../engine/stabilizer';

export interface SignObservation {
  sign: DuelSign;
  confidence: number;
  observedMs: number;
}

export interface DuelSignSource {
  readonly name: string;
  readonly mode: 'mock' | 'webcam';
  start(): void;
  stop(): void;
  onSign(listener: (observation: SignObservation) => void): Unsubscribe;
}

/** Keyboard-simulated signs. The page feeds key presses in through `press`. */
export class MockSignSource implements DuelSignSource {
  readonly name = 'Mock hand signs (keyboard)';
  readonly mode = 'mock' as const;
  private readonly listeners = new Set<(observation: SignObservation) => void>();
  private started = false;

  start(): void {
    this.started = true;
  }

  stop(): void {
    this.started = false;
  }

  onSign(listener: (observation: SignObservation) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  press(sign: DuelSign, nowMs: number): void {
    if (!this.started) return;
    const observation: SignObservation = { sign, confidence: 1, observedMs: nowMs };
    for (const listener of this.listeners) listener(observation);
  }
}

export interface WebcamSignSourceOptions {
  classifier: SignClassifier;
  /** The page's hand tracker subscription. */
  subscribe: (listener: (frame: LandmarkFrame) => void) => Unsubscribe;
  smoothingAlpha: number;
  holdMs: number;
  minConfidence: number;
  now?: () => number;
}

/**
 * Signs from the webcam through the trained model. The stabiliser requires the pose to be held
 * for `holdMs` above `minConfidence` and released before it can register again. Signs the model
 * knows but the duel does not use are treated as no sign.
 */
export class WebcamSignSource implements DuelSignSource {
  readonly name = 'Webcam hand signs (trained model)';
  readonly mode = 'webcam' as const;
  private readonly detector: MlSignDetector;
  private readonly stabilizer: SignStabilizer;
  private readonly now: () => number;
  private readonly listeners = new Set<(observation: SignObservation) => void>();
  private off: Unsubscribe | null = null;
  private lastConfidence = 0;

  constructor(options: WebcamSignSourceOptions) {
    this.detector = new MlSignDetector({
      classifier: options.classifier,
      smoothingAlpha: options.smoothingAlpha,
    });
    this.stabilizer = new SignStabilizer({
      holdMs: options.holdMs,
      threshold: options.minConfidence,
    });
    this.now = options.now ?? (() => performance.now());
    this.detector.setFrameSource(options.subscribe);
  }

  start(): void {
    this.off?.();
    this.off = this.detector.onFrame((frame) => {
      const sign = isDuelSign(frame.sign) ? frame.sign : 'none';
      this.lastConfidence = frame.confidence;
      const registered = this.stabilizer.observe({
        t: this.now(),
        sign,
        confidence: frame.confidence,
      });
      if (registered && isDuelSign(registered)) {
        const observation: SignObservation = {
          sign: registered,
          confidence: frame.confidence,
          observedMs: this.now(),
        };
        for (const listener of this.listeners) listener(observation);
      }
    });
    void this.detector.start();
  }

  stop(): void {
    this.off?.();
    this.off = null;
    this.detector.stop();
    this.stabilizer.reset();
  }

  onSign(listener: (observation: SignObservation) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The pose currently held and how far along the hold is, for the HUD. */
  hold(nowMs: number): { sign: DuelSign | null; fraction: number; confidence: number } {
    const progress = this.stabilizer.progress(nowMs);
    const sign = progress.sign && isDuelSign(progress.sign) ? progress.sign : null;
    return { sign, fraction: sign ? progress.fraction : 0, confidence: this.lastConfidence };
  }
}
