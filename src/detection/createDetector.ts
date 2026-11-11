import { BALANCE } from '../content/balance.config';
import type { InputMode, Settings } from '../lib/settings/schema';
import type { SignClassifier } from './classifier';
import { KeyboardSignDetector } from './keyboard';
import { MlSignDetector } from './ml';
import { modelStore } from './model';
import { DetectorError } from './types';

export { isModelAvailable } from './model';

/** The detectors the app actually builds; narrow on `kind` to reach their extras. */
export type AppSignDetector = KeyboardSignDetector | MlSignDetector;

export const NO_MODEL_MESSAGE =
  'No recognition model is installed yet. Keyboard mode is available.';

function loadedClassifier(): SignClassifier | null {
  const model = modelStore.get();
  return model.status === 'available' ? model.classifier : null;
}

/**
 * Builds the detector for the chosen input mode from the player's settings. Webcam mode needs
 * the recognition model, which `modelStore.load()` fetches at startup; pages check
 * `useModelState()` before getting here so the throw is a programming error, not a user path.
 */
export function createSignDetector(
  mode: InputMode,
  settings: Settings,
  options: { classifier?: SignClassifier } = {},
): AppSignDetector {
  if (mode === 'keyboard') {
    return new KeyboardSignDetector({ bindings: settings.keyBindings });
  }
  const classifier = options.classifier ?? loadedClassifier();
  if (!classifier) throw new DetectorError('model', NO_MODEL_MESSAGE);
  return new MlSignDetector({ classifier, smoothingAlpha: BALANCE.smoothingAlpha });
}
