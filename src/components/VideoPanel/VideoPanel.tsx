import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import type { LandmarkFrame } from '../../detection/types';
import { Spinner } from '../Spinner/Spinner';
import { LandmarkOverlay } from './LandmarkOverlay';
import styles from './VideoPanel.module.css';

export type VideoPanelState = 'loading' | 'live' | 'no-stream' | 'error';

export interface VideoPanelProps {
  stream: MediaStream | null;
  state: VideoPanelState;
  /** Shown under the panel; also the accessible name. */
  label: string;
  /** Flip horizontally for a mirror view. Display only; the stream is untouched. */
  mirror?: boolean;
  /** Receives the <video> element on mount (and null on unmount) so a hand tracker can use it. */
  onVideoElement?: (element: HTMLVideoElement | null) => void;
  /** Landmark overlay drawn from the latest frame; hidden when `show` is false. */
  overlay?: { frameRef: RefObject<LandmarkFrame | null>; show: boolean };
  /** Shown when there is no stream (the bot avatar). */
  avatar?: ReactNode;
  error?: { title: string; body: string; actions?: ReactNode };
  /** Flashes the border for a moment when it changes to true. */
  hit?: boolean;
  /** Corner HUD such as the detection readout. */
  children?: ReactNode;
}

/** Two of these face each other on the battle stage (docs/FRONTEND_DESIGN.md 6.5). */
export function VideoPanel({
  stream,
  state,
  label,
  mirror = false,
  onVideoElement,
  overlay,
  avatar,
  error,
  hit = false,
  children,
}: VideoPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) video.play().catch(() => undefined);
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    onVideoElement?.(videoRef.current);
    return () => onVideoElement?.(null);
  }, [onVideoElement]);

  return (
    <figure className={styles.panel} data-state={state} data-hit={hit || undefined}>
      <div className={styles.stage} data-mirror={mirror || undefined}>
        <video
          ref={videoRef}
          className={styles.video}
          autoPlay
          muted
          playsInline
          aria-label={label}
        />
        {overlay ? (
          <LandmarkOverlay frameRef={overlay.frameRef} show={overlay.show && state === 'live'} />
        ) : null}
      </div>

      {state === 'loading' ? (
        <div className={styles.cover}>
          <Spinner size={28} label="Starting camera" />
        </div>
      ) : null}

      {state === 'no-stream' ? <div className={styles.cover}>{avatar}</div> : null}

      {state === 'error' && error ? (
        <div className={`${styles.cover} ${styles.error}`} role="alert">
          <p className={styles.errorTitle}>{error.title}</p>
          <p className={styles.errorBody}>{error.body}</p>
          {error.actions ? <div className={styles.errorActions}>{error.actions}</div> : null}
        </div>
      ) : null}

      {children ? <div className={styles.hud}>{children}</div> : null}
      <figcaption className={styles.caption}>{label}</figcaption>
    </figure>
  );
}
