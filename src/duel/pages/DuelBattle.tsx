// The battle screen (spec section 06.3): bars and timer on top, the arena, then the camera or
// mock-sign block, the jutsu panel and the dodge indicator. Overlays carry the countdown,
// pauses, help and the result. All combat intent goes out as requests; the HUD reads the
// synced state and the renderer predicts only the local player's walk.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DT_MS,
  DUEL_CONFIG,
  JUTSUS,
  REJECT_TEXT,
  type DuelNetState,
  type DuelSign,
  type JutsuId,
  type MatchResultMessage,
  type PlayerNetState,
} from '@jutsu-duel/duel-shared';
import { Button } from '../../components/Button/Button';
import { VideoPanel } from '../../components/VideoPanel/VideoPanel';
import { DodgeIndicator } from '../hud/DodgeIndicator';
import { JutsuPanel } from '../hud/JutsuPanel';
import { NetworkBadge } from '../hud/NetworkBadge';
import { ResourceBar } from '../hud/ResourceBar';
import { useDuelKeys } from '../input/useDuelKeys';
import { useWebcamSigns } from '../input/useWebcamSigns';
import type { SignObservation } from '../input/signSource';
import type { DuelIdentity } from '../net/duelClient';
import type { DuelSession } from '../net/useDuelSession';
import { ArenaCanvas } from '../render/ArenaCanvas';
import { DuelPresenter } from '../render/DuelPresenter';
import { ControlsTable } from './ControlsTable';
import styles from './duel.module.css';

const GO_WORD_MS = 700;
const FEEDBACK_MS = 1800;
const HUD_REFRESH_MS = 100;
const SHIELD_MAX = JUTSUS.water_shield.kind === 'shield' ? JUTSUS.water_shield.absorb : 38;

export interface DuelBattleProps {
  session: DuelSession;
  identity: DuelIdentity;
}

function formatClock(ticks: number): string {
  const total = Math.max(0, Math.ceil((ticks * DT_MS) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function DuelBattle({ session, identity }: DuelBattleProps) {
  const state = session.state as DuelNetState;
  const { sessionId, version, getState, sendMove, lastProcessedInput } = session;
  const [presenter] = useState(() => new DuelPresenter());
  const [help, setHelp] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [playingSince, setPlayingSince] = useState<number | null>(null);
  /** Wall time sampled every HUD_REFRESH_MS, so render stays pure while cooldown text moves. */
  const [now, setNow] = useState(0);
  const lastSignAt = useRef(-Infinity);

  const me = state.players.get(sessionId) ?? null;
  const opponent = [...state.players.values()].find((p) => p.id !== sessionId) ?? null;
  const phase = state.phase;
  const live = phase === 'PLAYING' || phase === 'COUNTDOWN';
  const mock = identity.inputMode === 'mock';

  // The host acknowledges movement by sequence number; the presenter replays the rest.
  useEffect(() => {
    presenter.setLocal(sessionId, { lastProcessed: lastProcessedInput });
  }, [presenter, sessionId, lastProcessedInput]);

  // Every patch: feed snapshots for interpolation.
  useEffect(() => {
    presenter.onPatch(state, performance.now());
  }, [presenter, state, version]);

  // Transient events: effects for the renderer.
  useEffect(
    () =>
      session.subscribeEvents((event) => presenter.onEvent(event, getState(), performance.now())),
    [session, presenter, getState],
  );

  // Remember when play started for the GO word.
  useEffect(() => {
    if (phase === 'PLAYING') {
      queueMicrotask(() => setPlayingSince((current) => current ?? performance.now()));
    } else {
      queueMicrotask(() => setPlayingSince(null));
    }
  }, [phase]);

  // A slow clock for HUD text that moves between patches (cooldowns, hold ring, GO word).
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), HUD_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  // Rejections become a short HUD line.
  useEffect(() => {
    const rejection = session.rejection;
    if (!rejection) return;
    const timer = window.setTimeout(() => setFeedback(null), FEEDBACK_MS);
    queueMicrotask(() => setFeedback(REJECT_TEXT[rejection.reason]));
    return () => window.clearTimeout(timer);
  }, [session.rejection]);

  const sendSign = useCallback(
    (sign: DuelSign, confidence: number, observedMs: number) => {
      const at = performance.now();
      if (at - lastSignAt.current < DUEL_CONFIG.signs.minGapMs) {
        setFeedback(REJECT_TEXT.sign_too_fast);
        return;
      }
      lastSignAt.current = at;
      session.sendSign(sign, confidence, observedMs);
    },
    [session],
  );

  const onWebcamSign = useCallback(
    (observation: SignObservation) =>
      sendSign(observation.sign, observation.confidence, observation.observedMs),
    [sendSign],
  );
  const webcam = useWebcamSigns(identity.inputMode === 'webcam', onWebcamSign);

  const keyHandlers = useMemo(
    () => ({
      onDodge: () => session.requestDodge(),
      onSelect: (jutsuId: JutsuId) => session.selectJutsu(jutsuId),
      onMockSign: (sign: DuelSign) => sendSign(sign, 1, performance.now()),
      onCancelSigns: () => session.cancelSigns(),
      onToggleHelp: () => setHelp((open) => !open),
    }),
    [session, sendSign],
  );
  const keys = useDuelKeys(live && session.status === 'connected', mock, keyHandlers);

  // Movement intent at the server's tick rate while playing.
  useEffect(() => {
    const period = 1000 / DUEL_CONFIG.tickRate;
    const timer = window.setInterval(() => {
      if (getState()?.phase !== 'PLAYING') return;
      const direction = keys.direction();
      const seq = sendMove(direction.moveX, direction.moveY);
      presenter.history.push({ seq, moveX: direction.moveX, moveY: direction.moveY });
    }, period);
    return () => window.clearInterval(timer);
  }, [keys, presenter, getState, sendMove]);

  const countdownSeconds = Math.ceil(state.countdownTicksRemaining / state.tickRate);
  const showGo = phase === 'PLAYING' && playingSince !== null && now - playingSince < GO_WORD_MS;
  const hold = webcam.enabled ? webcam.hold(now) : { sign: null, fraction: 0, confidence: 0 };

  return (
    <main className={styles.battle} data-phase={phase}>
      <span className="visually-hidden" data-testid="phase">
        {phase}
      </span>
      <div className={styles.top}>
        <Side player={me} label="You" mirror={false} testPrefix="local" />
        <div className={styles.centre}>
          <span className={styles.timer} role="timer" data-testid="timer">
            {formatClock(state.activeTicksRemaining)}
          </span>
          {session.offlineLabel ? (
            <span className={styles.offline} data-testid="network">
              {session.offlineLabel}
            </span>
          ) : (
            <NetworkBadge room={session.room} status={session.status} />
          )}
        </div>
        <Side player={opponent} label="Opponent" mirror testPrefix="remote" />
      </div>

      <div className={styles.stage}>
        <ArenaCanvas getState={getState} presenter={presenter} label="Duel arena" />

        {phase === 'COUNTDOWN' ? (
          <div className={styles.overlay} role="status" data-testid="countdown">
            <span className={styles.overlayWord}>{countdownSeconds}</span>
            <span className="t-lead">{state.resuming ? 'Resuming' : 'Get ready'}</span>
          </div>
        ) : null}
        {showGo ? (
          <div className={styles.overlay} role="status" aria-live="assertive">
            <span className={styles.overlayWord}>GO</span>
          </div>
        ) : null}
        {phase === 'PAUSED_RECONNECT' ? (
          <div className={styles.overlay} role="status">
            <span className="t-display-sm">Paused</span>
            <span className="t-lead">
              {session.status === 'reconnecting'
                ? 'Reconnecting to the duel.'
                : `Waiting up to ${Math.round(DUEL_CONFIG.match.reconnectGraceMs / 1000)} s for ${opponent?.nickname ?? 'your opponent'} to reconnect.`}
            </span>
            <Button variant="ghost" onClick={() => void session.leave()}>
              Leave the duel
            </Button>
          </div>
        ) : null}
        {session.status === 'reconnecting' && phase !== 'PAUSED_RECONNECT' ? (
          <div className={styles.overlay} role="status">
            <span className="t-display-sm">Reconnecting</span>
          </div>
        ) : null}
        {phase === 'FINISHED' ? (
          <ResultOverlay session={session} result={session.result} me={me} opponent={opponent} />
        ) : null}
        {help ? (
          <div className={styles.overlay} role="dialog" aria-label="Controls">
            <div className={styles.overlayPanel}>
              <h2 className="t-heading">Controls</h2>
              <ControlsTable inputMode={identity.inputMode} />
              <div className={styles.overlayActions}>
                <Button onClick={() => setHelp(false)}>Close (Esc)</Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <p className={styles.feedback} aria-live="polite" data-testid="feedback">
        {feedback ?? ''}
      </p>

      <div className={styles.bottom}>
        <div className={styles.cameraBox}>
          {identity.inputMode === 'webcam' ? (
            <>
              <VideoPanel
                stream={webcam.stream}
                state={
                  webcam.camera.status === 'error'
                    ? 'error'
                    : webcam.camera.status === 'ready' && webcam.tracker.status !== 'loading'
                      ? 'live'
                      : 'loading'
                }
                label="Your camera"
                mirror={webcam.mirror}
                onVideoElement={webcam.attachVideo}
                overlay={{ frameRef: webcam.tracker.frameRef, show: webcam.showLandmarks }}
                error={
                  webcam.camera.status === 'error'
                    ? { title: 'Camera unavailable', body: webcam.camera.error.message }
                    : undefined
                }
              />
              <span className={styles.cameraNote}>
                Webcam hand signs: {webcam.status}
                {hold.sign ? `. Holding ${hold.sign} (${Math.round(hold.confidence * 100)}%)` : ''}
              </span>
            </>
          ) : (
            <div className={styles.modeBanner} data-mode="mock">
              MOCK HAND SIGNS. Keys Q E R T Y U I stand in for the camera.
            </div>
          )}
        </div>
        {me ? (
          <JutsuPanel
            player={me}
            tick={state.tick}
            inputMode={identity.inputMode}
            heldSign={hold.sign}
            heldFraction={hold.fraction}
            onSelect={(jutsuId) => session.selectJutsu(jutsuId)}
            onCancel={() => session.cancelSigns()}
          />
        ) : null}
        <div className={styles.side}>
          {me ? <DodgeIndicator player={me} tick={state.tick} /> : null}
          <Button variant="ghost" onClick={() => setHelp(true)}>
            Help (Esc)
          </Button>
        </div>
      </div>
    </main>
  );
}

function Side({
  player,
  label,
  mirror,
  testPrefix,
}: {
  player: PlayerNetState | null;
  label: string;
  mirror: boolean;
  testPrefix: string;
}) {
  return (
    <div className={styles.side} data-mirror={mirror || undefined}>
      <span className={styles.sideName}>
        {player ? player.nickname : label}
        {player && !player.connected ? ' (reconnecting)' : ''}
      </span>
      <ResourceBar
        label="HP"
        value={player?.hp ?? 0}
        max={DUEL_CONFIG.resources.maxHp}
        tone="hp"
        mirror={mirror}
        testId={`hp-${testPrefix}`}
      />
      <ResourceBar
        label="Chakra"
        value={player?.chakra ?? 0}
        max={DUEL_CONFIG.resources.maxChakra}
        tone="chakra"
        mirror={mirror}
        testId={`chakra-${testPrefix}`}
      />
      <ResourceBar
        label="Stamina"
        value={player?.stamina ?? 0}
        max={DUEL_CONFIG.resources.maxStamina}
        tone="stamina"
        mirror={mirror}
        testId={`stamina-${testPrefix}`}
      />
      {player && player.shieldHp > 0 ? (
        <ResourceBar
          label="Shield"
          value={player.shieldHp}
          max={SHIELD_MAX}
          tone="shield"
          mirror={mirror}
        />
      ) : null}
    </div>
  );
}

function ResultOverlay({
  session,
  result,
  me,
  opponent,
}: {
  session: DuelSession;
  result: MatchResultMessage | null;
  me: PlayerNetState | null;
  opponent: PlayerNetState | null;
}) {
  const state = session.state as DuelNetState;
  const winnerId = result?.winnerId ?? state.winnerId;
  const reason = result?.reason ?? state.resultReason;
  const word = winnerId === '' ? 'Draw' : winnerId === session.sessionId ? 'Victory' : 'Defeat';
  const how =
    reason === 'ko'
      ? 'by knockout'
      : reason === 'timeout'
        ? 'on time'
        : reason === 'forfeit'
          ? 'by forfeit'
          : '';
  const elapsed = result ? `${Math.round(result.elapsedMs / 1000)} s` : '';
  const mine = result?.players.find((p) => p.playerId === session.sessionId);
  const theirs = result?.players.find((p) => p.playerId !== session.sessionId);
  const opponentWants = opponent?.rematchVote ?? false;
  const iWant = me?.rematchVote ?? false;

  return (
    <div className={styles.overlay} role="status">
      <div className={styles.overlayPanel}>
        <span className={styles.overlayWord} data-testid="result-word">
          {word}
        </span>
        <p className="t-lead">
          {how
            ? `${word === 'Draw' ? 'Ended' : word === 'Defeat' ? 'Lost' : 'Won'} ${how}`
            : 'Match over'}
          {elapsed ? ` after ${elapsed}.` : '.'}
        </p>
        {mine && theirs ? (
          <table className={styles.stats}>
            <thead>
              <tr>
                <th scope="col"></th>
                <th scope="col">{mine.nickname}</th>
                <th scope="col">{theirs.nickname}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">HP left</th>
                <td>{mine.hpLeft}</td>
                <td>{theirs.hpLeft}</td>
              </tr>
              <tr>
                <th scope="row">Damage dealt</th>
                <td>{mine.damageDealt}</td>
                <td>{theirs.damageDealt}</td>
              </tr>
              <tr>
                <th scope="row">Jutsu cast</th>
                <td>
                  {mine.casts.fireball + mine.casts.lightning_spear + mine.casts.water_shield}
                </td>
                <td>
                  {theirs.casts.fireball + theirs.casts.lightning_spear + theirs.casts.water_shield}
                </td>
              </tr>
              <tr>
                <th scope="row">Dodges (successful)</th>
                <td>
                  {mine.dodgesUsed} ({mine.dodgesSuccessful})
                </td>
                <td>
                  {theirs.dodgesUsed} ({theirs.dodgesSuccessful})
                </td>
              </tr>
              <tr>
                <th scope="row">Shield absorbed</th>
                <td>{mine.shieldAbsorbed}</td>
                <td>{theirs.shieldAbsorbed}</td>
              </tr>
            </tbody>
          </table>
        ) : null}
        <p className="t-small t-muted">
          {opponent === null
            ? 'Your opponent has left.'
            : session.offlineLabel
              ? 'A rematch starts straight away.'
              : opponentWants && !iWant
                ? `${opponent.nickname} wants a rematch.`
                : iWant && !opponentWants
                  ? 'Waiting for your opponent to accept.'
                  : 'A rematch starts fresh when both accept.'}
        </p>
        <div className={styles.overlayActions}>
          <Button
            variant="primary"
            onClick={() => session.voteRematch(true)}
            disabled={iWant || opponent === null}
            data-testid="rematch"
          >
            {iWant ? 'Rematch requested' : 'Rematch'}
          </Button>
          <Button onClick={() => void session.leave()}>Leave</Button>
        </div>
      </div>
    </div>
  );
}
