/// <reference types="node" />
// Generates and checks the golden file the Python trainer's parity test reads
// (ml/tests/fixtures/features-golden.json). Run with UPDATE_GOLDEN=1 to regenerate after a
// feature spec change; otherwise this test proves the TypeScript extractor still reproduces it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractFeatures, FEATURE_SPEC } from './features';
import type { HandLandmarks, Handedness, Point3 } from './types';

const GOLDEN_PATH = resolve(__dirname, '../../ml/tests/fixtures/features-golden.json');

/** Deterministic pseudo-random generator so the fixture is reproducible. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function hand(
  rand: () => number,
  handedness: Handedness,
  cx: number,
  cy: number,
  size: number,
): HandLandmarks {
  const landmarks: Point3[] = [];
  for (let i = 0; i < 21; i += 1) {
    const angle = (i / 21) * Math.PI + (rand() - 0.5) * 0.1;
    const reach = (i === 0 ? 0 : 0.5 + (i % 4) / 4) * size;
    landmarks.push({
      x: round(cx + Math.cos(angle) * reach),
      y: round(cy - Math.sin(angle) * reach),
      z: round((rand() - 0.5) * 0.02),
    });
  }
  landmarks[9] = { x: round(cx), y: round(cy - size), z: 0 };
  return { handedness, score: 0.9, landmarks, worldLandmarks: landmarks };
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

interface GoldenCase {
  name: string;
  aspect: number;
  hands: HandLandmarks[];
  features: number[];
}

function buildCases(): GoldenCase[] {
  const rand = lcg(7);
  const inputs: Array<{ name: string; aspect: number; hands: HandLandmarks[] }> = [
    { name: 'no hands', aspect: 16 / 9, hands: [] },
    { name: 'left only', aspect: 16 / 9, hands: [hand(rand, 'Left', 0.3, 0.5, 0.12)] },
    { name: 'right only', aspect: 4 / 3, hands: [hand(rand, 'Right', 0.6, 0.4, 0.09)] },
    {
      name: 'two hands labelled',
      aspect: 16 / 9,
      hands: [hand(rand, 'Right', 0.62, 0.5, 0.1), hand(rand, 'Left', 0.35, 0.52, 0.11)],
    },
    {
      name: 'two hands same label (position fallback)',
      aspect: 16 / 9,
      hands: [hand(rand, 'Right', 0.7, 0.5, 0.1), hand(rand, 'Right', 0.25, 0.5, 0.1)],
    },
    {
      name: 'three hands (extra ignored)',
      aspect: 1,
      hands: [
        hand(rand, 'Left', 0.2, 0.5, 0.1),
        hand(rand, 'Right', 0.5, 0.5, 0.1),
        hand(rand, 'Right', 0.8, 0.5, 0.1),
      ],
    },
  ];
  return inputs.map((input) => ({
    ...input,
    features: Array.from(extractFeatures(input.hands, input.aspect)),
  }));
}

describe('hands-v1 golden file', () => {
  it('matches the committed fixture (or regenerates it with UPDATE_GOLDEN=1)', () => {
    const cases = buildCases();
    const document = { featureSpec: FEATURE_SPEC, cases };
    if (process.env.UPDATE_GOLDEN === '1' || !existsSync(GOLDEN_PATH)) {
      mkdirSync(dirname(GOLDEN_PATH), { recursive: true });
      writeFileSync(GOLDEN_PATH, JSON.stringify(document, null, 2) + '\n');
    }
    const stored = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as typeof document;
    expect(stored.featureSpec).toBe(FEATURE_SPEC);
    expect(stored.cases.map((c) => c.name)).toEqual(cases.map((c) => c.name));
    stored.cases.forEach((storedCase, index) => {
      const fresh = cases[index];
      expect(fresh).toBeDefined();
      expect(storedCase.features).toHaveLength(131);
      storedCase.features.forEach((value, i) => {
        expect(Math.abs(value - (fresh?.features[i] ?? Number.NaN))).toBeLessThan(1e-6);
      });
    });
  });
});
