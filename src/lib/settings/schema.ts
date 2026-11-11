// User settings (docs/DESIGN.md 9.4). Validated with zod at every boundary: localStorage,
// Supabase rows, and anything else that arrives as unknown JSON. Each field falls back to
// its default on its own, so one bad value never resets the whole settings object.
import { z } from 'zod';
import { SIGN_IDS, type SignId } from '../../engine/types';

export const THEMES = ['system', 'dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];

export const INPUT_MODES = ['webcam', 'keyboard'] as const;
export type InputMode = (typeof INPUT_MODES)[number];

/** Zodiac order on a 4 x 3 key block: QWER / ASDF / ZXCV. Values are KeyboardEvent.code. */
export const DEFAULT_KEY_BINDINGS: Record<SignId, string> = {
  rat: 'KeyQ',
  ox: 'KeyW',
  tiger: 'KeyE',
  hare: 'KeyR',
  dragon: 'KeyA',
  snake: 'KeyS',
  horse: 'KeyD',
  ram: 'KeyF',
  monkey: 'KeyZ',
  bird: 'KeyX',
  dog: 'KeyC',
  boar: 'KeyV',
};

export const CONFIDENCE_THRESHOLD = { min: 0.5, max: 0.95, step: 0.05, default: 0.7 } as const;

const unitInterval = (fallback: number) => z.number().min(0).max(1).catch(fallback);

export const settingsSchema = z.object({
  version: z.literal(1).catch(1),
  theme: z.enum(THEMES).catch('system'),
  inputMode: z.enum(INPUT_MODES).catch('webcam'),
  cameraDeviceId: z.string().nullable().catch(null),
  mirrorVideo: z.boolean().catch(true),
  showLandmarks: z.boolean().catch(true),
  confidenceThreshold: z
    .number()
    .min(CONFIDENCE_THRESHOLD.min)
    .max(CONFIDENCE_THRESHOLD.max)
    .catch(CONFIDENCE_THRESHOLD.default),
  keyBindings: z.record(z.enum(SIGN_IDS), z.string()).catch(DEFAULT_KEY_BINDINGS),
  volume: z
    .object({
      master: unitInterval(0.8),
      sfx: unitInterval(0.8),
      music: unitInterval(0.5),
    })
    .catch({ master: 0.8, sfx: 0.8, music: 0.5 }),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

/** Parses unknown JSON into Settings, substituting defaults field by field. */
export function parseSettings(raw: unknown): Settings {
  const source = raw !== null && typeof raw === 'object' ? raw : {};
  return settingsSchema.parse(source);
}
