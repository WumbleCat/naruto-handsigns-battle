import { useEffect, useRef } from 'react';
import { DUEL_CONFIG, type DuelNetState } from '@jutsu-duel/duel-shared';
import { drawArena, readTheme } from './arenaRenderer';
import type { DuelPresenter } from './DuelPresenter';
import styles from './ArenaCanvas.module.css';

export interface ArenaCanvasProps {
  /** Returns the latest authoritative state, read every frame outside React's render cycle. */
  getState: () => DuelNetState | null;
  presenter: DuelPresenter;
  label: string;
}

/** The top-down arena at a fixed 1200 x 700 world size, scaled to its container. */
export function ArenaCanvas({ getState, presenter, label }: ArenaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let frame = 0;
    let lastThemeAt = 0;
    let theme = readTheme(canvas);

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = DUEL_CONFIG.arena.width;
      const height = DUEL_CONFIG.arena.height;
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        canvas.width = width * ratio;
        canvas.height = height * ratio;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const render = (now: number) => {
      resize();
      if (now - lastThemeAt > 1000) {
        theme = readTheme(canvas);
        lastThemeAt = now;
      }
      const state = getState();
      if (state) drawArena(context, presenter.frame(state, now), theme);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [getState, presenter]);

  return <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={label} />;
}
