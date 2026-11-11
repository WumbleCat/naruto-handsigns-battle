import { ComingSoon } from '../ComingSoon';

/** Dev-only training data recorder (docs/DESIGN.md 7.6). */
export function RecorderPage() {
  return (
    <ComingSoon
      title="Recorder"
      milestone="v0.3.0"
      summary="Webcam with landmark overlay, pick a sign, countdown, capture N samples, export labelled JSON."
      backTo="/"
      backLabel="Back"
    />
  );
}
