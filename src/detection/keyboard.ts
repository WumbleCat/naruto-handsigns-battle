// Keyboard sign detector (docs/DESIGN.md 7.5): twelve keys map to the twelve signs. While a
// key is held it emits that sign at confidence 1.0 every animation frame, otherwise 'none',
// so the stabiliser applies the same hold time as the webcam and the engine sees identical input.
// On-screen sign buttons use the same detector through hold() and release().
import type { SignId } from '../engine/types';
import type { DetectorError, DetectorStatus, SignDetector, SignFrame, Unsubscribe } from './types';

export interface KeyboardSignDetectorOptions {
  /** SignId -> KeyboardEvent.code */
  bindings: Record<SignId, string>;
  /** Event target for key events; defaults to window. */
  target?: EventTarget;
  /** Clock; defaults to performance.now. */
  now?: () => number;
  /** Frame scheduler; defaults to requestAnimationFrame. Tests pass null and call tick(). */
  schedule?: ((callback: () => void) => number) | null;
  cancel?: (handle: number) => void;
}

/** Something currently held: a physical key (by code) or an on-screen sign button. */
type Held = { source: 'key'; code: string } | { source: 'pad'; sign: SignId };

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return EDITABLE_TAGS.has(target.tagName) || target.isContentEditable;
}

export class KeyboardSignDetector implements SignDetector {
  readonly kind = 'keyboard' as const;
  status: DetectorStatus = 'idle';
  readonly error: DetectorError | null = null;

  private codeToSign = new Map<string, SignId>();
  private readonly target: EventTarget;
  private readonly now: () => number;
  private readonly schedule: ((callback: () => void) => number) | null;
  private readonly cancel: (handle: number) => void;
  /** Everything held, in press order; the most recent wins when several are down. */
  private held: Held[] = [];
  private frameHandle = 0;
  private readonly frameListeners = new Set<(frame: SignFrame) => void>();
  private readonly statusListeners = new Set<(status: DetectorStatus) => void>();

  constructor(options: KeyboardSignDetectorOptions) {
    this.setBindings(options.bindings);
    this.target = options.target ?? window;
    this.now = options.now ?? (() => performance.now());
    this.schedule =
      options.schedule === undefined
        ? (callback) => requestAnimationFrame(callback)
        : options.schedule;
    this.cancel = options.cancel ?? ((handle) => cancelAnimationFrame(handle));
  }

  setBindings(bindings: Record<SignId, string>): void {
    this.codeToSign = new Map(
      (Object.entries(bindings) as Array<[SignId, string]>).map(([sign, code]) => [code, sign]),
    );
    this.held = this.held.filter((h) => h.source === 'pad' || this.codeToSign.has(h.code));
  }

  /** Start holding a sign from an on-screen button. Idempotent until release(). */
  hold(sign: SignId): void {
    this.held = [
      ...this.held.filter((h) => !(h.source === 'pad' && h.sign === sign)),
      { source: 'pad', sign },
    ];
  }

  release(sign: SignId): void {
    this.held = this.held.filter((h) => !(h.source === 'pad' && h.sign === sign));
  }

  onFrame(listener: (frame: SignFrame) => void): Unsubscribe {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  onStatus(listener: (status: DetectorStatus) => void): Unsubscribe {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  start(): Promise<void> {
    if (this.status === 'ready') return Promise.resolve();
    this.target.addEventListener('keydown', this.onKeyDown);
    this.target.addEventListener('keyup', this.onKeyUp);
    this.target.addEventListener('blur', this.onBlur);
    this.setStatus('ready');
    this.loop();
    return Promise.resolve();
  }

  stop(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
    if (this.frameHandle) this.cancel(this.frameHandle);
    this.frameHandle = 0;
    this.held = [];
    this.setStatus('idle');
  }

  /** The frame for the current key state. Public so tests and the loop share one path. */
  sample(t = this.now()): SignFrame {
    for (let i = this.held.length - 1; i >= 0; i -= 1) {
      const held = this.held[i];
      if (!held) continue;
      const sign = held.source === 'pad' ? held.sign : this.codeToSign.get(held.code);
      if (sign) return { t, sign, confidence: 1 };
    }
    return { t, sign: 'none', confidence: 0 };
  }

  /** Emit one frame to the listeners. The animation loop calls this; tests call it directly. */
  tick(): void {
    const frame = this.sample();
    for (const listener of this.frameListeners) listener(frame);
  }

  /** The sign currently held, for the keyboard hint in the HUD. */
  heldSign(): SignId | null {
    const frame = this.sample();
    return frame.sign === 'none' ? null : frame.sign;
  }

  private onKeyDown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent) || event.repeat) return;
    if (isEditable(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (!this.codeToSign.has(event.code)) return;
    event.preventDefault();
    this.held = [
      ...this.held.filter((h) => h.source === 'pad' || h.code !== event.code),
      { source: 'key', code: event.code },
    ];
  };

  private onKeyUp = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) return;
    this.held = this.held.filter((h) => h.source === 'pad' || h.code !== event.code);
  };

  private onBlur = (): void => {
    this.held = [];
  };

  private loop = (): void => {
    this.tick();
    if (this.schedule) this.frameHandle = this.schedule(this.loop);
  };

  private setStatus(status: DetectorStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }
}
