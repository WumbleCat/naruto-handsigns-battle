import { describe, expect, it } from 'vitest';
import type { HandLandmarks } from '../../detection/types';
import {
  countByLabel,
  createRecording,
  createSignReferences,
  isUsableSample,
  parseRecording,
  RECORDING_FORMAT,
  signReferencesSchema,
  type RecordingSample,
} from './recording';

function hand(): HandLandmarks {
  const landmarks = Array.from({ length: 21 }, (_, i) => ({ x: i / 21, y: 0.5, z: 0 }));
  return { handedness: 'Left', score: 0.9, landmarks, worldLandmarks: landmarks };
}

const META = {
  sessionId: 'abc',
  recordedAt: '2026-11-11T00:00:00Z',
  device: { userAgent: 'test', videoWidth: 1280, videoHeight: 720, mirror: true },
};

describe('recording format', () => {
  it('round-trips through create and parse', () => {
    const samples: RecordingSample[] = [
      { label: 'tiger', t: 1, hands: [hand()] },
      { label: 'none', t: 2, hands: [] },
    ];
    const file = createRecording(META, samples);
    expect(file.format).toBe(RECORDING_FORMAT);
    expect(file.featureSpec).toBe('hands-v1');
    expect(parseRecording(JSON.parse(JSON.stringify(file)))).toEqual(file);
  });

  it('rejects files with the wrong format or a bad label', () => {
    expect(() => parseRecording({ format: 'other' })).toThrow(/Not a jutsu-duel-recording/);
    const file = createRecording(META, [{ label: 'tiger', t: 1, hands: [hand()] }]);
    const broken = { ...file, samples: [{ ...file.samples[0], label: 'phoenix' }] };
    expect(() => parseRecording(broken)).toThrow();
  });

  it('counts samples per label with zeros for the rest', () => {
    const counts = countByLabel([
      { label: 'tiger', t: 1, hands: [hand()] },
      { label: 'tiger', t: 2, hands: [hand()] },
      { label: 'none', t: 3, hands: [] },
    ]);
    expect(counts.tiger).toBe(2);
    expect(counts.none).toBe(1);
    expect(counts.rat).toBe(0);
  });

  it('requires a hand for sign labels but not for none', () => {
    expect(isUsableSample('tiger', [])).toBe(false);
    expect(isUsableSample('tiger', [hand()])).toBe(true);
    expect(isUsableSample('none', [])).toBe(true);
  });

  it('builds a valid sign references file', () => {
    const file = createSignReferences({ tiger: { width: 1280, height: 720, hands: [hand()] } });
    expect(signReferencesSchema.safeParse(file).success).toBe(true);
  });
});
