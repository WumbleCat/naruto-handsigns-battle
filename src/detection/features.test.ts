import { describe, expect, it } from 'vitest';
import { assignSlots, extractFeatures, FEATURE_DIM, PER_HAND_DIM } from './features';
import type { HandLandmarks, Handedness, Point3 } from './types';

/** A synthetic hand: wrist at (x, y), fingers fanning out at a given size. */
function hand(handedness: Handedness, x: number, y: number, size = 0.1, z = 0): HandLandmarks {
  const landmarks: Point3[] = [];
  for (let i = 0; i < 21; i += 1) {
    const angle = (i / 21) * Math.PI;
    const reach = (i === 0 ? 0 : 0.5 + (i % 4) / 4) * size;
    landmarks.push({ x: x + Math.cos(angle) * reach, y: y - Math.sin(angle) * reach, z });
  }
  // Landmark 9 (middle MCP) defines the scale; make it exactly `size` away from the wrist.
  landmarks[9] = { x, y: y - size, z };
  return { handedness, score: 0.95, landmarks, worldLandmarks: landmarks };
}

describe('extractFeatures (hands-v1)', () => {
  it('produces 131 features with zeros and absent flags when no hand is visible', () => {
    const out = extractFeatures([], 16 / 9);
    expect(out).toHaveLength(FEATURE_DIM);
    expect(Array.from(out).every((v) => v === 0)).toBe(true);
  });

  it('sets presence flags per slot', () => {
    const left = extractFeatures([hand('Left', 0.3, 0.5)], 1);
    expect(left[129]).toBe(1);
    expect(left[130]).toBe(0);
    const right = extractFeatures([hand('Right', 0.6, 0.5)], 1);
    expect(right[129]).toBe(0);
    expect(right[130]).toBe(1);
  });

  it('is invariant to translation', () => {
    const a = extractFeatures([hand('Left', 0.2, 0.3), hand('Right', 0.5, 0.3)], 1);
    const b = extractFeatures([hand('Left', 0.4, 0.6), hand('Right', 0.7, 0.6)], 1);
    expect(Array.from(a).map((v) => v.toFixed(6))).toEqual(Array.from(b).map((v) => v.toFixed(6)));
  });

  it('is invariant to scale (distance from the camera)', () => {
    const near = extractFeatures([hand('Left', 0.2, 0.5, 0.2), hand('Right', 0.6, 0.5, 0.2)], 1);
    const far = extractFeatures([hand('Left', 0.2, 0.5, 0.1), hand('Right', 0.4, 0.5, 0.1)], 1);
    expect(Array.from(near).map((v) => v.toFixed(6))).toEqual(
      Array.from(far).map((v) => v.toFixed(6)),
    );
  });

  it('puts the wrist at the origin of each hand block', () => {
    const out = extractFeatures([hand('Left', 0.3, 0.5), hand('Right', 0.6, 0.5)], 1);
    expect(out.slice(0, 3)).toEqual(new Float32Array([0, 0, 0]));
    expect(out.slice(PER_HAND_DIM, PER_HAND_DIM + 3)).toEqual(new Float32Array([0, 0, 0]));
  });

  it('encodes the wrist-to-wrist offset in hand scale units', () => {
    const out = extractFeatures([hand('Left', 0.3, 0.5, 0.1), hand('Right', 0.5, 0.5, 0.1)], 1);
    expect(out[126]).toBeCloseTo(2, 5);
    expect(out[127]).toBeCloseTo(0, 5);
  });

  it('applies the aspect ratio before measuring', () => {
    const square = extractFeatures([hand('Left', 0.3, 0.5, 0.1), hand('Right', 0.5, 0.5, 0.1)], 1);
    const wide = extractFeatures([hand('Left', 0.3, 0.5, 0.1), hand('Right', 0.5, 0.5, 0.1)], 2);
    // With a wider frame the horizontal gap doubles while the vertical hand scale does not.
    expect(wide[126]).toBeCloseTo(square[126]! * 2, 5);
  });
});

describe('assignSlots', () => {
  it('uses handedness labels when they differ', () => {
    const left = hand('Left', 0.8, 0.5);
    const right = hand('Right', 0.2, 0.5);
    expect(assignSlots([right, left])).toEqual({ left, right });
  });

  it('falls back to image position when both hands carry the same label', () => {
    const a = hand('Right', 0.7, 0.5);
    const b = hand('Right', 0.2, 0.5);
    expect(assignSlots([a, b])).toEqual({ left: b, right: a });
  });

  it('ignores hands with too few landmarks', () => {
    const broken: HandLandmarks = {
      handedness: 'Left',
      score: 1,
      landmarks: [],
      worldLandmarks: [],
    };
    expect(assignSlots([broken])).toEqual({ left: null, right: null });
  });
});
