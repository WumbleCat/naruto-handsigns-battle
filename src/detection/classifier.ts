// Browser inference for the exported MLP (docs/DESIGN.md 7.4): a few dense layers evaluated
// in plain TypeScript, no ML runtime. The file is validated with zod before use.
import { z } from 'zod';
import { FEATURE_DIM, FEATURE_SPEC } from './features';

export const MODEL_FORMAT = 'jutsu-duel-mlp';

const denseLayerSchema = z.object({
  type: z.literal('dense'),
  weights: z.array(z.array(z.number()).min(1)).min(1),
  bias: z.array(z.number()).min(1),
  activation: z.enum(['relu', 'softmax', 'linear']),
});

export const modelFileSchema = z.object({
  format: z.literal(MODEL_FORMAT),
  version: z.literal(1),
  createdAt: z.string(),
  featureSpec: z.literal(FEATURE_SPEC),
  inputDim: z.literal(FEATURE_DIM),
  labels: z.array(z.string()).min(2),
  standardisation: z.object({
    mean: z.array(z.number()).length(FEATURE_DIM),
    std: z.array(z.number()).length(FEATURE_DIM),
  }),
  layers: z.array(denseLayerSchema).min(1),
  metrics: z.record(z.string(), z.unknown()).optional(),
  training: z.record(z.string(), z.unknown()).optional(),
});

export type MlpModelFile = z.infer<typeof modelFileSchema>;

export function parseModelFile(input: unknown): MlpModelFile {
  const result = modelFileSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Not a ${MODEL_FORMAT} file: ${result.error.issues[0]?.message ?? 'invalid'}`);
  }
  const file = result.data;
  let width = file.inputDim;
  for (const layer of file.layers) {
    if (layer.weights.some((row) => row.length !== width)) {
      throw new Error(`Layer expects ${width} inputs but its weights have another shape`);
    }
    if (layer.bias.length !== layer.weights.length) {
      throw new Error('Layer bias length does not match its output size');
    }
    width = layer.weights.length;
  }
  const last = file.layers[file.layers.length - 1];
  if (last && last.weights.length !== file.labels.length) {
    throw new Error('Output layer size does not match the label count');
  }
  return file;
}

export interface SignClassifier {
  readonly labels: readonly string[];
  /** Class probabilities in `labels` order for one feature vector. */
  predict(features: Float32Array): Float32Array;
}

export class MlpClassifier implements SignClassifier {
  readonly labels: readonly string[];
  private readonly mean: Float32Array;
  private readonly invStd: Float32Array;
  private readonly layers: Array<{
    weights: Float32Array;
    rows: number;
    cols: number;
    bias: Float32Array;
    activation: 'relu' | 'softmax' | 'linear';
  }>;

  constructor(file: MlpModelFile) {
    this.labels = file.labels;
    this.mean = Float32Array.from(file.standardisation.mean);
    this.invStd = Float32Array.from(file.standardisation.std, (s) => (s === 0 ? 1 : 1 / s));
    this.layers = file.layers.map((layer) => ({
      weights: Float32Array.from(layer.weights.flat()),
      rows: layer.weights.length,
      cols: layer.weights[0]?.length ?? 0,
      bias: Float32Array.from(layer.bias),
      activation: layer.activation,
    }));
  }

  predict(features: Float32Array): Float32Array {
    let x = new Float32Array(features.length);
    for (let i = 0; i < features.length; i += 1) {
      x[i] = ((features[i] ?? 0) - (this.mean[i] ?? 0)) * (this.invStd[i] ?? 1);
    }
    for (const layer of this.layers) {
      const out = new Float32Array(layer.rows);
      for (let r = 0; r < layer.rows; r += 1) {
        let sum = layer.bias[r] ?? 0;
        const base = r * layer.cols;
        for (let c = 0; c < layer.cols; c += 1) {
          sum += (layer.weights[base + c] ?? 0) * (x[c] ?? 0);
        }
        out[r] = layer.activation === 'relu' ? Math.max(0, sum) : sum;
      }
      if (layer.activation === 'softmax') softmaxInPlace(out);
      x = out;
    }
    return x;
  }
}

function softmaxInPlace(values: Float32Array): void {
  let max = -Infinity;
  for (const v of values) max = Math.max(max, v);
  let total = 0;
  for (let i = 0; i < values.length; i += 1) {
    const e = Math.exp((values[i] ?? 0) - max);
    values[i] = e;
    total += e;
  }
  for (let i = 0; i < values.length; i += 1) values[i] = (values[i] ?? 0) / (total || 1);
}

export function argmax(values: Float32Array): number {
  let best = 0;
  for (let i = 1; i < values.length; i += 1) {
    if ((values[i] ?? 0) > (values[best] ?? 0)) best = i;
  }
  return best;
}
