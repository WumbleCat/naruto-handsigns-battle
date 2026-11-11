// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_KEY_BINDINGS } from '../lib/settings/schema';
import { KeyboardSignDetector } from './keyboard';

function key(type: 'keydown' | 'keyup', code: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, ...init }));
}

let detector: KeyboardSignDetector | null = null;

afterEach(() => {
  detector?.stop();
  detector = null;
});

describe('KeyboardSignDetector', () => {
  it('reports none when nothing is held', async () => {
    detector = new KeyboardSignDetector({ bindings: DEFAULT_KEY_BINDINGS, now: () => 5 });
    await detector.start();
    expect(detector.sample()).toEqual({ t: 5, sign: 'none', confidence: 0 });
  });

  it('reports the held sign at full confidence and releases on keyup', async () => {
    detector = new KeyboardSignDetector({ bindings: DEFAULT_KEY_BINDINGS, now: () => 7 });
    await detector.start();
    key('keydown', 'KeyE');
    expect(detector.sample()).toEqual({ t: 7, sign: 'tiger', confidence: 1 });
    key('keyup', 'KeyE');
    expect(detector.sample().sign).toBe('none');
  });

  it('prefers the most recently pressed key when several are held', async () => {
    detector = new KeyboardSignDetector({ bindings: DEFAULT_KEY_BINDINGS });
    await detector.start();
    key('keydown', 'KeyE');
    key('keydown', 'KeyD');
    expect(detector.sample().sign).toBe('horse');
    key('keyup', 'KeyD');
    expect(detector.sample().sign).toBe('tiger');
  });

  it('ignores unbound keys, auto-repeat and modifier chords', async () => {
    detector = new KeyboardSignDetector({ bindings: DEFAULT_KEY_BINDINGS });
    await detector.start();
    key('keydown', 'KeyP');
    key('keydown', 'KeyE', { repeat: true });
    key('keydown', 'KeyW', { ctrlKey: true });
    expect(detector.sample().sign).toBe('none');
  });

  it('ignores keys typed into form fields', async () => {
    detector = new KeyboardSignDetector({ bindings: DEFAULT_KEY_BINDINGS });
    await detector.start();
    const input = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
    expect(detector.sample().sign).toBe('none');
    input.remove();
  });

  it('honours rebinding at runtime', async () => {
    detector = new KeyboardSignDetector({ bindings: DEFAULT_KEY_BINDINGS });
    await detector.start();
    detector.setBindings({ ...DEFAULT_KEY_BINDINGS, tiger: 'KeyT' });
    key('keydown', 'KeyE');
    expect(detector.sample().sign).toBe('none');
    key('keydown', 'KeyT');
    expect(detector.sample().sign).toBe('tiger');
  });

  it('clears held keys when the window loses focus', async () => {
    detector = new KeyboardSignDetector({ bindings: DEFAULT_KEY_BINDINGS });
    await detector.start();
    key('keydown', 'KeyE');
    window.dispatchEvent(new Event('blur'));
    expect(detector.sample().sign).toBe('none');
  });

  it('stops listening after stop()', async () => {
    detector = new KeyboardSignDetector({ bindings: DEFAULT_KEY_BINDINGS });
    await detector.start();
    detector.stop();
    key('keydown', 'KeyE');
    expect(detector.sample().sign).toBe('none');
    expect(detector.status).toBe('idle');
  });
});
