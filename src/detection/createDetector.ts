import type { InputMode, Settings } from '../lib/settings/schema';
import { KeyboardSignDetector } from './keyboard';
import { DetectorError, type SignDetector } from './types';

/**
 * Whether a trained recognition model ships with this build. Flipped to a real check when the
 * ML detector lands (milestone v0.6.0); until then webcam mode cannot register signs.
 */
export function isModelAvailable(): boolean {
  return false;
}

/** Builds the detector for the chosen input mode from the player's settings. */
export function createSignDetector(mode: InputMode, settings: Settings): SignDetector {
  if (mode === 'keyboard') {
    return new KeyboardSignDetector({ bindings: settings.keyBindings });
  }
  throw new DetectorError(
    'model',
    'No recognition model is installed yet. Keyboard mode is available.',
  );
}
