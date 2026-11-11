/// <reference types="node" />
// Checks the recognition model that ships in public/models with the exact inference code the
// browser runs. The structural checks run with every `npm test`; the accuracy check against
// the recordings in ml/data/raw (large, personal, git-ignored) runs with `npm run model:check`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SIGN_IDS } from '../engine/types';
import { parseRecording, type SampleLabel } from '../features/recorder/recording';
import { argmax, MlpClassifier, parseModelFile } from './classifier';
import { extractFeatures, FEATURE_DIM } from './features';
import { MlSignDetector } from './ml';

const MODEL_PATH = resolve(__dirname, '../../public/models/signs-v1.json');
const RAW_DIR = resolve(__dirname, '../../ml/data/raw');
const CHECK_RECORDINGS = import.meta.env.MODE === 'recordings';
/** Recordings hold tens of thousands of frames; a spread of a few thousand is plenty. */
const MAX_SAMPLES_PER_FILE = 3000;
const MIN_ACCURACY = 0.9;

function loadModel() {
  const file = parseModelFile(JSON.parse(readFileSync(MODEL_PATH, 'utf8')));
  return { file, classifier: new MlpClassifier(file) };
}

function recordingPaths(): string[] {
  if (!existsSync(RAW_DIR)) return [];
  return readdirSync(RAW_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => resolve(RAW_DIR, name));
}

describe.skipIf(!existsSync(MODEL_PATH))('shipped recognition model', () => {
  it('has the labels and feature spec the detector expects', () => {
    const { file } = loadModel();
    expect(file.labels).toEqual(['none', ...SIGN_IDS]);
    expect(file.inputDim).toBe(FEATURE_DIM);
    expect(file.layers.at(-1)?.activation).toBe('softmax');
  });

  it('returns a probability distribution and reads an empty frame as none', () => {
    const { classifier } = loadModel();
    const probabilities = classifier.predict(new Float32Array(FEATURE_DIM));
    expect(probabilities).toHaveLength(13);
    expect(Array.from(probabilities).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4);
    const detector = new MlSignDetector({ classifier, smoothingAlpha: 1 });
    expect(detector.classify({ t: 0, width: 640, height: 480, hands: [] }).sign).toBe('none');
  });

  it.skipIf(!CHECK_RECORDINGS)('agrees with the labels of the local recordings', () => {
    const paths = recordingPaths();
    expect(paths.length, `no recordings in ${RAW_DIR}`).toBeGreaterThan(0);
    const { file, classifier } = loadModel();
    const seen = new Map<SampleLabel, { total: number; correct: number }>();
    let total = 0;
    let correct = 0;

    for (const path of paths) {
      const recording = parseRecording(JSON.parse(readFileSync(path, 'utf8')));
      const { videoWidth, videoHeight } = recording.device;
      const aspect = videoHeight > 0 ? videoWidth / videoHeight : 16 / 9;
      const stride = Math.max(1, Math.ceil(recording.samples.length / MAX_SAMPLES_PER_FILE));
      for (let i = 0; i < recording.samples.length; i += stride) {
        const sample = recording.samples[i];
        if (!sample) continue;
        const predicted =
          file.labels[argmax(classifier.predict(extractFeatures(sample.hands, aspect)))];
        const entry = seen.get(sample.label) ?? { total: 0, correct: 0 };
        entry.total += 1;
        total += 1;
        if (predicted === sample.label) {
          entry.correct += 1;
          correct += 1;
        }
        seen.set(sample.label, entry);
      }
    }

    const lines = [...seen.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, e]) => `  ${label.padEnd(8)} ${(e.correct / e.total).toFixed(3)} (${e.total})`);
    console.log(
      `model vs ${paths.length} recording(s), ${total} frames: accuracy ${(correct / total).toFixed(3)}\n${lines.join('\n')}`,
    );
    expect(correct / total).toBeGreaterThanOrEqual(MIN_ACCURACY);
  });
});
