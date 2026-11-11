import { describe, expect, it } from 'vitest';
import { argmax, MlpClassifier, parseModelFile, type MlpModelFile } from './classifier';
import { FEATURE_DIM } from './features';

/** A tiny two-layer model whose output is decided by the first three features. */
function tinyModel(): MlpModelFile {
  const hidden = 3;
  const w1 = Array.from({ length: hidden }, (_, r) =>
    Array.from({ length: FEATURE_DIM }, (_, c) => (c === r ? 1 : 0)),
  );
  const w2 = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  return {
    format: 'jutsu-duel-mlp',
    version: 1,
    createdAt: '2026-11-11T00:00:00Z',
    featureSpec: 'hands-v1',
    inputDim: FEATURE_DIM,
    labels: ['none', 'tiger', 'horse'],
    standardisation: {
      mean: Array.from({ length: FEATURE_DIM }, () => 0),
      std: Array.from({ length: FEATURE_DIM }, () => 1),
    },
    layers: [
      { type: 'dense', weights: w1, bias: [0, 0, 0], activation: 'relu' },
      { type: 'dense', weights: w2, bias: [0, 0, 0], activation: 'softmax' },
    ],
  };
}

describe('MlpClassifier', () => {
  it('returns a probability vector that picks the dominant feature', () => {
    const classifier = new MlpClassifier(parseModelFile(tinyModel()));
    const features = new Float32Array(FEATURE_DIM);
    features[1] = 4; // "tiger"
    const probabilities = classifier.predict(features);
    expect(probabilities).toHaveLength(3);
    expect(Array.from(probabilities).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    expect(argmax(probabilities)).toBe(1);
    expect(classifier.labels[argmax(probabilities)]).toBe('tiger');
  });

  it('applies standardisation and relu', () => {
    const file = tinyModel();
    file.standardisation.mean[2] = 10;
    const classifier = new MlpClassifier(parseModelFile(file));
    const features = new Float32Array(FEATURE_DIM);
    features[2] = 10; // standardises to 0; relu keeps negatives at 0 so all logits tie
    const probabilities = classifier.predict(features);
    expect(probabilities[0]).toBeCloseTo(1 / 3, 5);
  });

  it('rejects files with mismatched shapes or the wrong format', () => {
    const file = tinyModel();
    expect(() => parseModelFile({ ...file, format: 'other' })).toThrow(/Not a jutsu-duel-mlp/);
    const badBias = { ...file, layers: [{ ...file.layers[0]!, bias: [0] }, file.layers[1]!] };
    expect(() => parseModelFile(badBias)).toThrow(/bias/);
    const badLabels = { ...file, labels: ['none', 'tiger'] };
    expect(() => parseModelFile(badLabels)).toThrow(/label count/);
  });
});
