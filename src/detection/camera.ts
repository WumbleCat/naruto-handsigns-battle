// Camera service (docs/DESIGN.md 7.1): getUserMedia with sensible constraints, a fallback when
// the preferred device or resolution is unavailable, and typed errors the UI can explain.

export type CameraErrorCode =
  'permission-denied' | 'not-found' | 'in-use' | 'unsupported' | 'ended' | 'unknown';

export class CameraError extends Error {
  readonly code: CameraErrorCode;

  constructor(code: CameraErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CameraError';
    this.code = code;
  }
}

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export const PREFERRED_VIDEO: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30 },
  facingMode: 'user',
};

/** Maps a getUserMedia failure to a CameraError. Exported for tests. */
export function toCameraError(error: unknown): CameraError {
  if (error instanceof CameraError) return error;
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return new CameraError('permission-denied', message, { cause: error });
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return new CameraError('not-found', message, { cause: error });
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new CameraError('in-use', message, { cause: error });
    case 'TypeError':
      return new CameraError('unsupported', message, { cause: error });
    default:
      return new CameraError('unknown', message, { cause: error });
  }
}

function mediaDevices(): MediaDevices {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('unsupported', 'This browser cannot access a camera.');
  }
  return navigator.mediaDevices;
}

/** Video inputs. Labels are empty until the user has granted camera permission once. */
export async function listCameras(): Promise<CameraDevice[]> {
  const devices = await mediaDevices().enumerateDevices();
  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Camera ${index + 1}`,
    }));
}

/**
 * Opens the camera. Tries the chosen device at the preferred resolution first, then any
 * camera at any resolution, so an unplugged or picky device never blocks play.
 */
export async function openCamera(deviceId: string | null): Promise<MediaStream> {
  const media = mediaDevices();
  const attempts: MediaStreamConstraints[] = [];
  if (deviceId) attempts.push({ video: { ...PREFERRED_VIDEO, deviceId: { exact: deviceId } } });
  attempts.push({ video: PREFERRED_VIDEO });
  attempts.push({ video: true });

  let lastError: unknown = null;
  for (const constraints of attempts) {
    try {
      return await media.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
      const name = error instanceof Error ? error.name : '';
      // Only constraint problems justify a retry; permission and hardware errors are final.
      if (name !== 'OverconstrainedError' && name !== 'ConstraintNotSatisfiedError') break;
    }
  }
  throw toCameraError(lastError);
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}
