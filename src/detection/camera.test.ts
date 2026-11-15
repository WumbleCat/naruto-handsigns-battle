import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraError, listCameras, toCameraError } from './camera';

function domError(name: string): Error {
  const error = new Error(`${name} happened`);
  error.name = name;
  return error;
}

describe('toCameraError', () => {
  it.each([
    ['NotAllowedError', 'permission-denied'],
    ['SecurityError', 'permission-denied'],
    ['NotFoundError', 'not-found'],
    ['NotReadableError', 'in-use'],
    ['AbortError', 'in-use'],
    ['TypeError', 'unsupported'],
    ['SomethingElse', 'unknown'],
  ] as const)('maps %s to %s', (name, code) => {
    const error = toCameraError(domError(name));
    expect(error).toBeInstanceOf(CameraError);
    expect(error.code).toBe(code);
    expect(error.message).toContain(name);
  });

  it('passes an existing CameraError through unchanged', () => {
    const original = new CameraError('ended', 'Camera disconnected');
    expect(toCameraError(original)).toBe(original);
  });

  it('copes with non-Error values', () => {
    expect(toCameraError('boom').code).toBe('unknown');
    expect(toCameraError('boom').message).toBe('boom');
  });
});

describe('listCameras', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubDevices(devices: Array<Partial<MediaDeviceInfo>>) {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: () => Promise.reject(new Error('not used')),
        enumerateDevices: () => Promise.resolve(devices),
      },
    });
  }

  it('lists video inputs with a fallback label', async () => {
    stubDevices([
      { kind: 'videoinput', deviceId: 'a', label: 'Front' },
      { kind: 'audioinput', deviceId: 'mic', label: 'Mic' },
      { kind: 'videoinput', deviceId: 'b', label: '' },
    ]);
    expect(await listCameras()).toEqual([
      { deviceId: 'a', label: 'Front' },
      { deviceId: 'b', label: 'Camera 2' },
    ]);
  });

  it('leaves out the unnamed devices reported before permission is granted', async () => {
    stubDevices([
      { kind: 'videoinput', deviceId: '', label: '' },
      { kind: 'videoinput', deviceId: '', label: '' },
      { kind: 'videoinput', deviceId: 'a', label: 'Front' },
      { kind: 'videoinput', deviceId: 'a', label: 'Front again' },
    ]);
    expect(await listCameras()).toEqual([{ deviceId: 'a', label: 'Front' }]);
  });
});
