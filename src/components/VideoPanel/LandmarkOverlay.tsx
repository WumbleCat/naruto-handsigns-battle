import { useEffect, useRef, type RefObject } from 'react';
import { HAND_CONNECTIONS } from '../../detection/handConnections';
import type { LandmarkFrame } from '../../detection/types';

interface LandmarkOverlayProps {
  frameRef: RefObject<LandmarkFrame | null>;
  show: boolean;
}

/**
 * Draws joints and bones over the video (docs/FRONTEND_DESIGN.md 4.5). Reads the latest
 * frame from a ref on every animation frame, so tracking never re-renders React.
 */
export function LandmarkOverlay({ frameRef, show }: LandmarkOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let rafId = 0;
    const style = getComputedStyle(canvas);
    const joint = style.getPropertyValue('--text').trim() || '#f4efe4';
    const bone = style.getPropertyValue('--text-2').trim() || '#c5cee0';

    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const frame = frameRef.current;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      if (!show || !frame || frame.hands.length === 0) return;

      // The video is object-fit: cover; map normalised coordinates through the same crop.
      const videoAspect = frame.width / frame.height;
      const canvasAspect = width / height;
      let scaleX = width;
      let scaleY = height;
      let offsetX = 0;
      let offsetY = 0;
      if (videoAspect > canvasAspect) {
        scaleX = height * videoAspect;
        offsetX = (width - scaleX) / 2;
      } else {
        scaleY = width / videoAspect;
        offsetY = (height - scaleY) / 2;
      }

      for (const hand of frame.hands) {
        const alpha = Math.max(0.25, Math.min(1, hand.score));
        context.lineWidth = 2;
        context.lineCap = 'round';
        context.strokeStyle = bone;
        context.globalAlpha = alpha * 0.7;
        context.beginPath();
        for (const [from, to] of HAND_CONNECTIONS) {
          const a = hand.landmarks[from];
          const b = hand.landmarks[to];
          if (!a || !b) continue;
          context.moveTo(offsetX + a.x * scaleX, offsetY + a.y * scaleY);
          context.lineTo(offsetX + b.x * scaleX, offsetY + b.y * scaleY);
        }
        context.stroke();

        context.fillStyle = joint;
        context.globalAlpha = alpha * 0.85;
        for (const point of hand.landmarks) {
          context.beginPath();
          context.arc(offsetX + point.x * scaleX, offsetY + point.y * scaleY, 3, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
    };

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [frameRef, show]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
}
