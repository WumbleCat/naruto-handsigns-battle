// Feature spec "hands-v1" (docs/DESIGN.md 7.3). The Python trainer re-implements this
// exactly; ml/tests checks parity against a golden file produced by this code.
import { MIDDLE_MCP, WRIST } from './handConnections';
import type { HandLandmarks, Point3 } from './types';

export const FEATURE_SPEC = 'hands-v1';
export const LANDMARKS_PER_HAND = 21;
export const PER_HAND_DIM = LANDMARKS_PER_HAND * 3; // 63
export const FEATURE_DIM = PER_HAND_DIM * 2 + 3 + 2; // 131

const OFFSET_LEFT = 0;
const OFFSET_RIGHT = PER_HAND_DIM;
const OFFSET_INTER = PER_HAND_DIM * 2; // 126..128
const OFFSET_PRESENCE = OFFSET_INTER + 3; // 129, 130

interface NormalisedHand {
  points: Point3[];
  wrist: Point3;
  scale: number;
}

function aspectCorrect(points: Point3[], aspect: number): Point3[] {
  return points.map((p) => ({ x: p.x * aspect, y: p.y, z: p.z * aspect }));
}

function distance(a: Point3, b: Point3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function normalise(hand: HandLandmarks, aspect: number): NormalisedHand | null {
  if (hand.landmarks.length < LANDMARKS_PER_HAND) return null;
  const points = aspectCorrect(hand.landmarks.slice(0, LANDMARKS_PER_HAND), aspect);
  const wrist = points[WRIST] as Point3;
  const middle = points[MIDDLE_MCP] as Point3;
  const scale = Math.max(distance(wrist, middle), 1e-6);
  return { points, wrist, scale };
}

/**
 * Assigns hands to the left and right slots. Handedness labels win; when both hands carry
 * the same label, the leftmost wrist in the image takes the left slot.
 */
export function assignSlots(hands: HandLandmarks[]): {
  left: HandLandmarks | null;
  right: HandLandmarks | null;
} {
  const usable = hands.filter((hand) => hand.landmarks.length >= LANDMARKS_PER_HAND).slice(0, 2);
  if (usable.length === 0) return { left: null, right: null };
  if (usable.length === 1) {
    const only = usable[0] as HandLandmarks;
    return only.handedness === 'Left' ? { left: only, right: null } : { left: null, right: only };
  }
  const [a, b] = usable as [HandLandmarks, HandLandmarks];
  if (a.handedness !== b.handedness) {
    return a.handedness === 'Left' ? { left: a, right: b } : { left: b, right: a };
  }
  const ax = a.landmarks[WRIST]?.x ?? 0;
  const bx = b.landmarks[WRIST]?.x ?? 0;
  return ax <= bx ? { left: a, right: b } : { left: b, right: a };
}

/**
 * 131 features: two hands x 21 landmarks x 3 (wrist-relative, scale-normalised), the
 * wrist-to-wrist offset in mean hand scale, and two presence flags. Missing hands are zero.
 * `aspect` is videoWidth / videoHeight so geometry is not squashed.
 */
export function extractFeatures(hands: HandLandmarks[], aspect: number): Float32Array {
  const out = new Float32Array(FEATURE_DIM);
  const slots = assignSlots(hands);
  const left = slots.left ? normalise(slots.left, aspect) : null;
  const right = slots.right ? normalise(slots.right, aspect) : null;

  const write = (hand: NormalisedHand | null, offset: number) => {
    if (!hand) return;
    hand.points.forEach((p, index) => {
      const base = offset + index * 3;
      out[base] = (p.x - hand.wrist.x) / hand.scale;
      out[base + 1] = (p.y - hand.wrist.y) / hand.scale;
      out[base + 2] = (p.z - hand.wrist.z) / hand.scale;
    });
  };
  write(left, OFFSET_LEFT);
  write(right, OFFSET_RIGHT);

  if (left && right) {
    const meanScale = (left.scale + right.scale) / 2;
    out[OFFSET_INTER] = (right.wrist.x - left.wrist.x) / meanScale;
    out[OFFSET_INTER + 1] = (right.wrist.y - left.wrist.y) / meanScale;
    out[OFFSET_INTER + 2] = (right.wrist.z - left.wrist.z) / meanScale;
  }

  out[OFFSET_PRESENCE] = left ? 1 : 0;
  out[OFFSET_PRESENCE + 1] = right ? 1 : 0;
  return out;
}
