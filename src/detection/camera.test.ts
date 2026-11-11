import { describe, expect, it } from 'vitest';
import { CameraError, toCameraError } from './camera';

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
