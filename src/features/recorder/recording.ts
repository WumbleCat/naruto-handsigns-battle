// Training data formats (docs/DESIGN.md 7.6). Recordings store raw landmarks, never images,
// so feature engineering can change without re-recording.
import { z } from 'zod';
import { FEATURE_SPEC } from '../../detection/features';
import type { HandLandmarks } from '../../detection/types';
import { SIGN_IDS, type SignId } from '../../engine/types';

export const RECORDING_FORMAT = 'jutsu-duel-recording';
export const SIGN_REFERENCES_FORMAT = 'jutsu-duel-sign-references';

export type SampleLabel = SignId | 'none';
export const SAMPLE_LABELS: readonly SampleLabel[] = [...SIGN_IDS, 'none'];

const point = z.object({ x: z.number(), y: z.number(), z: z.number() });

const handSchema = z.object({
  handedness: z.enum(['Left', 'Right']),
  score: z.number(),
  landmarks: z.array(point).length(21),
  worldLandmarks: z.array(point),
});

const sampleSchema = z.object({
  label: z.enum([...SIGN_IDS, 'none']),
  t: z.number(),
  hands: z.array(handSchema).max(2),
});

export const recordingSchema = z.object({
  format: z.literal(RECORDING_FORMAT),
  version: z.literal(1),
  sessionId: z.string(),
  recordedAt: z.string(),
  featureSpec: z.string(),
  device: z.object({
    userAgent: z.string(),
    videoWidth: z.number(),
    videoHeight: z.number(),
    mirror: z.boolean(),
  }),
  samples: z.array(sampleSchema),
});

export type RecordingSample = z.infer<typeof sampleSchema>;
export type RecordingFile = z.infer<typeof recordingSchema>;
export type RecordingDevice = RecordingFile['device'];

export function createRecording(
  meta: { sessionId: string; recordedAt: string; device: RecordingDevice },
  samples: readonly RecordingSample[],
): RecordingFile {
  return {
    format: RECORDING_FORMAT,
    version: 1,
    sessionId: meta.sessionId,
    recordedAt: meta.recordedAt,
    featureSpec: FEATURE_SPEC,
    device: meta.device,
    samples: [...samples],
  };
}

/** Validates an imported file; throws with a readable message on a bad one. */
export function parseRecording(input: unknown): RecordingFile {
  const result = recordingSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Not a ${RECORDING_FORMAT} file: ${result.error.issues[0]?.message ?? 'invalid'}`,
    );
  }
  return result.data;
}

export function countByLabel(samples: readonly RecordingSample[]): Record<SampleLabel, number> {
  const counts = Object.fromEntries(SAMPLE_LABELS.map((label) => [label, 0])) as Record<
    SampleLabel,
    number
  >;
  for (const sample of samples) counts[sample.label] += 1;
  return counts;
}

/** Whether a frame is usable as a sample for `label`: hands required unless recording 'none'. */
export function isUsableSample(label: SampleLabel, hands: readonly HandLandmarks[]): boolean {
  return label === 'none' || hands.length > 0;
}

export const signReferencesSchema = z.object({
  format: z.literal(SIGN_REFERENCES_FORMAT),
  version: z.literal(1),
  references: z.partialRecord(
    z.enum(SIGN_IDS),
    z.object({ width: z.number(), height: z.number(), hands: z.array(handSchema).min(1).max(2) }),
  ),
});

export type SignReferencesFile = z.infer<typeof signReferencesSchema>;
export type SignReference = SignReferencesFile['references'][SignId];

export function createSignReferences(
  references: Partial<Record<SignId, SignReference>>,
): SignReferencesFile {
  return { format: SIGN_REFERENCES_FORMAT, version: 1, references: { ...references } };
}
