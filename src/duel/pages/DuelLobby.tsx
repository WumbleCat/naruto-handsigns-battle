// The room before the match: invite code, both seats, ready toggle, camera check in webcam mode.
import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { PageShell } from '../../components/PageShell/PageShell';
import { VideoPanel } from '../../components/VideoPanel/VideoPanel';
import type { DuelIdentity } from '../net/duelClient';
import type { DuelSession } from '../net/useDuelSession';
import { useWebcamSigns } from '../input/useWebcamSigns';
import { ControlsTable } from './ControlsTable';
import styles from './duel.module.css';

export interface DuelLobbyProps {
  session: DuelSession;
  identity: DuelIdentity;
}

export function DuelLobby({ session, identity }: DuelLobbyProps) {
  const { room, state, sessionId } = session;
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const webcam = useWebcamSigns(identity.inputMode === 'webcam', () => undefined);
  const roomId = room?.roomId ?? '';
  const inviteUrl = `${window.location.origin}/duel/${roomId}`;
  const players = state ? [...state.players.values()].sort((a, b) => a.slot - b.slot) : [];
  const me = players.find((p) => p.id === sessionId);
  const ready = me?.ready ?? false;

  const copy = async (text: string, what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  return (
    <PageShell wide>
      <h1 className="t-display-md">Duel lobby</h1>
      <div className={styles.lobby}>
        <div className={styles.setup}>
          <section className={styles.invite} aria-labelledby="invite-heading">
            <h2 id="invite-heading" className="t-heading">
              Invite code
            </h2>
            <span className={styles.code} data-testid="invite-code">
              {roomId}
            </span>
            <div className={styles.inviteRow}>
              <Button onClick={() => void copy(roomId, 'code')}>
                {copied === 'code' ? 'Copied' : 'Copy code'}
              </Button>
              <Button variant="ghost" onClick={() => void copy(inviteUrl, 'link')}>
                {copied === 'link' ? 'Copied' : 'Copy link'}
              </Button>
            </div>
            <span className={styles.url}>{inviteUrl}</span>
          </section>

          <div className={styles.seats} data-testid="seats">
            {[1, 2].map((slot) => {
              const player = players.find((p) => p.slot === slot);
              return (
                <div
                  key={slot}
                  className={styles.seat}
                  data-ready={player?.ready || undefined}
                  data-you={player?.id === sessionId || undefined}
                >
                  <span className={styles.seatStatus}>Player {slot}</span>
                  <span className={styles.seatName}>
                    {player ? player.nickname : 'Waiting for an opponent'}
                  </span>
                  <span className={styles.seatStatus}>
                    {player
                      ? `${player.connected ? 'Connected' : 'Reconnecting'}${player.ready ? ', ready' : ', not ready'}${player.id === sessionId ? ' (you)' : ''}`
                      : 'Share the code or link'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className={styles.modeBanner} data-mode={identity.inputMode}>
            {identity.inputMode === 'mock'
              ? 'MOCK HAND SIGNS: signs come from the Q E R T Y U I keys. No camera is used.'
              : `Webcam hand signs: ${webcam.status}.`}
          </div>

          <div className={styles.lobbyActions}>
            <Button
              variant={ready ? 'ghost' : 'primary'}
              size="lg"
              onClick={() => session.setReady(!ready)}
              disabled={identity.inputMode === 'webcam' && !webcam.ready && !ready}
              data-testid="ready"
            >
              {ready ? 'Unready' : 'Ready'}
            </Button>
            <Button variant="ghost" onClick={() => void session.leave()}>
              Leave
            </Button>
            <span className="t-small t-muted">
              {players.length < 2
                ? 'The countdown starts when both players are ready.'
                : ready
                  ? 'Waiting for your opponent.'
                  : 'Press Ready when you are set.'}
            </span>
          </div>

          {session.notices.length > 0 ? (
            <ul className={styles.notices} aria-live="polite">
              {session.notices.slice(-3).map((notice) => (
                <li key={notice.id}>{notice.message}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className={styles.preview}>
          {identity.inputMode === 'webcam' ? (
            <VideoPanel
              stream={webcam.stream}
              state={
                webcam.camera.status === 'error'
                  ? 'error'
                  : webcam.camera.status === 'ready' && webcam.tracker.status !== 'loading'
                    ? 'live'
                    : 'loading'
              }
              label="Your camera (stays on this device)"
              mirror={webcam.mirror}
              onVideoElement={webcam.attachVideo}
              overlay={{ frameRef: webcam.tracker.frameRef, show: webcam.showLandmarks }}
              error={
                webcam.camera.status === 'error'
                  ? { title: 'Camera unavailable', body: webcam.camera.error.message }
                  : undefined
              }
            />
          ) : null}
          <h2 className="t-heading">Controls</h2>
          <ControlsTable inputMode={identity.inputMode} />
        </div>
      </div>
    </PageShell>
  );
}
