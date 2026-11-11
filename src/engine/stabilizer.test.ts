import { describe, expect, it } from 'vitest';
import { SignStabilizer, type SignFrame } from './stabilizer';
import type { SignId } from './types';

const HOLD = 250;
const THRESHOLD = 0.7;

function frames(sign: SignId | 'none', from: number, to: number, step = 50, confidence = 0.9) {
  const list: SignFrame[] = [];
  for (let t = from; t <= to; t += step) list.push({ t, sign, confidence });
  return list;
}

function run(stabilizer: SignStabilizer, list: SignFrame[]): Array<{ t: number; sign: SignId }> {
  const out: Array<{ t: number; sign: SignId }> = [];
  for (const frame of list) {
    const sign = stabilizer.observe(frame);
    if (sign) out.push({ t: frame.t, sign });
  }
  return out;
}

describe('SignStabilizer', () => {
  it('registers a sign once it has been held for the hold time', () => {
    const s = new SignStabilizer({ holdMs: HOLD, threshold: THRESHOLD });
    expect(run(s, frames('tiger', 0, 200))).toEqual([]);
    expect(run(s, frames('tiger', 250, 250))).toEqual([{ t: 250, sign: 'tiger' }]);
  });

  it('does not register the same held sign twice', () => {
    const s = new SignStabilizer({ holdMs: HOLD, threshold: THRESHOLD });
    expect(run(s, frames('tiger', 0, 2000))).toHaveLength(1);
  });

  it('registers the same sign again after a release through none', () => {
    const s = new SignStabilizer({ holdMs: HOLD, threshold: THRESHOLD });
    const out = run(s, [
      ...frames('tiger', 0, 300),
      ...frames('none', 350, 400),
      ...frames('tiger', 450, 700),
    ]);
    expect(out.map((o) => o.sign)).toEqual(['tiger', 'tiger']);
  });

  it('registers a different sign after the first without a gap', () => {
    const s = new SignStabilizer({ holdMs: HOLD, threshold: THRESHOLD });
    const out = run(s, [...frames('tiger', 0, 300), ...frames('horse', 350, 600)]);
    expect(out).toEqual([
      { t: 250, sign: 'tiger' },
      { t: 600, sign: 'horse' },
    ]);
  });

  it('restarts the hold timer when the sign changes', () => {
    const s = new SignStabilizer({ holdMs: HOLD, threshold: THRESHOLD });
    const out = run(s, [...frames('tiger', 0, 200), ...frames('horse', 250, 450)]);
    expect(out).toEqual([]);
    expect(run(s, frames('horse', 500, 500))).toEqual([{ t: 500, sign: 'horse' }]);
  });

  it('treats low-confidence frames as none', () => {
    const s = new SignStabilizer({ holdMs: HOLD, threshold: THRESHOLD });
    expect(run(s, frames('tiger', 0, 500, 50, 0.69))).toEqual([]);
    expect(run(s, frames('tiger', 550, 800, 50, 0.7))).toEqual([{ t: 800, sign: 'tiger' }]);
  });

  it('lets the threshold change at runtime', () => {
    const s = new SignStabilizer({ holdMs: HOLD, threshold: 0.9 });
    expect(run(s, frames('tiger', 0, 500, 50, 0.8))).toEqual([]);
    s.setThreshold(0.5);
    expect(run(s, frames('tiger', 550, 800, 50, 0.8))).toHaveLength(1);
  });

  it('reports hold progress for a meter', () => {
    const s = new SignStabilizer({ holdMs: HOLD, threshold: THRESHOLD });
    run(s, frames('tiger', 0, 100));
    expect(s.progress(125)).toEqual({ sign: 'tiger', fraction: 0.5 });
    run(s, frames('tiger', 150, 300));
    expect(s.progress(400)).toEqual({ sign: 'tiger', fraction: 1 });
    run(s, frames('none', 350, 350));
    expect(s.progress(400)).toEqual({ sign: null, fraction: 0 });
  });
});
