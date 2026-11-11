import { describe, expect, it, vi } from 'vitest';
import type { SignClassifier } from './classifier';
import { MlSignDetector } from './ml';
import type { HandLandmarks, LandmarkFrame, SignFrame } from './types';

/** Returns a scripted probability vector per call, ignoring the features. */
function scripted(labels: string[], outputs: number[][]): SignClassifier & { calls: number } {
  const classifier = {
    labels,
    calls: 0,
    predict(): Float32Array {
      const next = outputs[Math.min(classifier.calls, outputs.length - 1)] ?? [];
      classifier.calls += 1;
      return Float32Array.from(next);
    },
  };
  return classifier;
}

function hand(handedness: 'Left' | 'Right', cx: number): HandLandmarks {
  const landmarks = Array.from({ length: 21 }, (_, i) => ({
    x: cx + (i % 5) * 0.02,
    y: 0.5 - Math.floor(i / 5) * 0.03,
    z: 0,
  }));
  return { handedness, score: 0.9, landmarks, worldLandmarks: landmarks };
}

function frame(t: number, hands: HandLandmarks[]): LandmarkFrame {
  return { t, width: 640, height: 480, hands };
}

/** A frame source that records its listener so tests can push frames. */
function fakeSource() {
  let listener: ((frame: LandmarkFrame) => void) | null = null;
  const unsubscribe = vi.fn(() => {
    listener = null;
  });
  const source = vi.fn((next: (frame: LandmarkFrame) => void) => {
    listener = next;
    return unsubscribe;
  });
  return {
    source,
    unsubscribe,
    push: (f: LandmarkFrame) => listener?.(f),
    get attached() {
      return listener !== null;
    },
  };
}

describe('MlSignDetector', () => {
  it('emits none without classifying when no hands are visible', () => {
    const classifier = scripted(['none', 'tiger', 'ram'], [[0, 1, 0]]);
    const detector = new MlSignDetector({ classifier, smoothingAlpha: 0.5 });
    const result = detector.classify(frame(10, []));
    expect(result).toEqual({ t: 10, sign: 'none', confidence: 1 });
    expect(classifier.calls).toBe(0);
  });

  it('maps the best label to a sign and smooths across frames', () => {
    const classifier = scripted(
      ['none', 'tiger', 'ram'],
      [
        [0.1, 0.8, 0.1],
        [0.1, 0.1, 0.8],
        [0.1, 0.1, 0.8],
      ],
    );
    const detector = new MlSignDetector({ classifier, smoothingAlpha: 0.5 });
    const hands = [hand('Right', 0.6), hand('Left', 0.3)];

    const first = detector.classify(frame(1, hands));
    expect(first.sign).toBe('tiger');
    expect(first.confidence).toBeCloseTo(0.8, 5);

    // One contradicting frame is not enough: the average still favours the earlier sign.
    const second = detector.classify(frame(2, hands));
    expect(second.sign).toBe('tiger');
    expect(second.confidence).toBeCloseTo(0.45, 5);

    const third = detector.classify(frame(3, hands));
    expect(third.sign).toBe('ram');
    expect(third.confidence).toBeCloseTo(0.625, 5);
    expect(third.probabilities).toHaveLength(3);
  });

  it('treats unknown labels and the none class as no sign', () => {
    const classifier = scripted(
      ['none', 'mystery', 'tiger'],
      [
        [0.2, 0.7, 0.1],
        [0.9, 0.05, 0.05],
      ],
    );
    const detector = new MlSignDetector({ classifier, smoothingAlpha: 1 });
    expect(detector.classify(frame(1, [hand('Right', 0.5)])).sign).toBe('none');
    expect(detector.classify(frame(2, [hand('Right', 0.5)])).sign).toBe('none');
  });

  it('resets smoothing after the hands leave the frame', () => {
    const classifier = scripted(
      ['none', 'tiger', 'ram'],
      [
        [0, 1, 0],
        [0, 0, 1],
      ],
    );
    const detector = new MlSignDetector({ classifier, smoothingAlpha: 0.1 });
    detector.classify(frame(1, [hand('Right', 0.5)]));
    detector.classify(frame(2, []));
    expect(detector.classify(frame(3, [hand('Right', 0.5)])).sign).toBe('ram');
  });

  it('is loading until a frame source is attached and only emits while started', async () => {
    const classifier = scripted(['none', 'tiger'], [[0, 1]]);
    const detector = new MlSignDetector({ classifier, smoothingAlpha: 1 });
    const statuses: string[] = [];
    detector.onStatus((status) => statuses.push(status));
    const frames: SignFrame[] = [];
    detector.onFrame((f) => frames.push(f));
    const source = fakeSource();

    await detector.start();
    expect(detector.status).toBe('loading');
    expect(source.attached).toBe(false);

    detector.setFrameSource(source.source);
    expect(detector.status).toBe('ready');
    source.push(frame(5, [hand('Right', 0.5)]));
    expect(frames).toHaveLength(1);
    expect(frames[0]?.sign).toBe('tiger');

    detector.stop();
    expect(detector.status).toBe('idle');
    expect(source.unsubscribe).toHaveBeenCalledTimes(1);
    expect(source.attached).toBe(false);
    expect(statuses).toEqual(['loading', 'ready', 'idle']);

    // A source set while stopped is picked up by the next start.
    detector.setFrameSource(source.source);
    expect(source.attached).toBe(false);
    await detector.start();
    expect(detector.status).toBe('ready');
    expect(source.attached).toBe(true);
    detector.stop();
  });

  it('swaps frame sources without leaking the old subscription', async () => {
    const classifier = scripted(['none', 'tiger'], [[0, 1]]);
    const detector = new MlSignDetector({ classifier, smoothingAlpha: 1 });
    const a = fakeSource();
    const b = fakeSource();
    detector.setFrameSource(a.source);
    await detector.start();
    detector.setFrameSource(b.source);
    expect(a.unsubscribe).toHaveBeenCalledTimes(1);
    expect(b.attached).toBe(true);
    detector.setFrameSource(null);
    expect(b.unsubscribe).toHaveBeenCalledTimes(1);
    expect(detector.status).toBe('loading');
    detector.stop();
  });
});
