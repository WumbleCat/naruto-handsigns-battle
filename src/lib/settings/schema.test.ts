import { describe, expect, it } from 'vitest';
import { DEFAULT_KEY_BINDINGS, DEFAULT_SETTINGS, parseSettings } from './schema';

describe('settings schema', () => {
  it('produces sensible defaults from nothing', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('system');
    expect(DEFAULT_SETTINGS.inputMode).toBe('webcam');
    expect(DEFAULT_SETTINGS.mirrorVideo).toBe(true);
    expect(DEFAULT_SETTINGS.confidenceThreshold).toBe(0.7);
    expect(DEFAULT_SETTINGS.keyBindings).toEqual(DEFAULT_KEY_BINDINGS);
  });

  it('keeps valid values', () => {
    const parsed = parseSettings({ theme: 'light', confidenceThreshold: 0.85, mirrorVideo: false });
    expect(parsed.theme).toBe('light');
    expect(parsed.confidenceThreshold).toBe(0.85);
    expect(parsed.mirrorVideo).toBe(false);
  });

  it('replaces only the invalid field with its default', () => {
    const parsed = parseSettings({ theme: 'neon', inputMode: 'keyboard', confidenceThreshold: 2 });
    expect(parsed.theme).toBe('system');
    expect(parsed.inputMode).toBe('keyboard');
    expect(parsed.confidenceThreshold).toBe(0.7);
  });

  it('falls back to default key bindings when a sign is missing', () => {
    const parsed = parseSettings({ keyBindings: { tiger: 'KeyT' } });
    expect(parsed.keyBindings).toEqual(DEFAULT_KEY_BINDINGS);
  });

  it('tolerates non-object input', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('garbage')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(42)).toEqual(DEFAULT_SETTINGS);
  });

  it('maps the twelve signs to twelve distinct keys by default', () => {
    expect(new Set(Object.values(DEFAULT_KEY_BINDINGS)).size).toBe(12);
  });
});
