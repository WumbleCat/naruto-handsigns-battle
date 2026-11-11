// The battle stage (docs/FRONTEND_DESIGN.md 6.5). Full-width, top bar hidden, symmetric
// about the centre: everything the player does on the left, the opponent on the right.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Button } from '../components/Button/Button';
import { DetectionReadout } from '../components/DetectionReadout/DetectionReadout';
import { Dialog } from '../components/Dialog/Dialog';
import { VideoPanel } from '../components/VideoPanel/VideoPanel';
import { BALANCE, ENGINE_BALANCE } from '../content/balance.config';
import { CONTENT } from '../content/content.config';
import { isRosterJutsuId, ROSTER } from '../content/roster';
import type { ThemedElement } from '../content/types';
import { createSignDetector } from '../detection/createDetector';
import { SequenceMatcher } from '../engine/sequence';
import type { SignId } from '../engine/types';
import { BattleController } from '../features/battle/BattleController';
import { useBattleSession } from '../features/battle/battleSessionContext';
import {
  useControllerPhase,
  useEngineEvent,
  useEngineSnapshot,
  useFrameTick,
} from '../features/battle/hooks';
import { BotAvatar } from '../features/battle/hud/BotAvatar';
import { CooldownSeal } from '../features/battle/hud/CooldownSeal';
import { FlightStrip, type ClashBurst, type DodgeMark } from '../features/battle/hud/FlightStrip';
import { HpBar } from '../features/battle/hud/HpBar';
import { CountdownOverlay, ResultWord } from '../features/battle/hud/Overlay';
import { SignTrail } from '../features/battle/hud/SignTrail';
import { Timer } from '../features/battle/hud/Timer';
import { KeyMap } from '../features/battle/KeyMap';
import { buildOutcome } from '../features/battle/outcome';
import { useCamera } from '../features/camera/useCamera';
import { useHandTracker } from '../features/camera/useHandTracker';
import { BotOpponent } from '../opponent/bot';
import { useAuth } from '../features/auth/authContext';
import { useReducedMotion } from '../lib/useReducedMotion';
import { useSettings } from '../lib/settings/store';
import styles from './BattlePage.module.css';

const FIGHT_WORD_MS = 600;
const HIT_FLASH_MS = 220;
const BURST_MS = 800;
const DODGE_MS = 600;
const matcher = new SequenceMatcher(ROSTER);

function openerElement(buffer: readonly SignId[]): ThemedElement | null {
  const match = matcher.match(buffer);
  if (buffer.length === 0 || match.status === 'none') return null;
  const jutsu = match.status === 'complete' ? match.jutsu : match.candidates[0];
  return jutsu ? (jutsu.element ?? 'substitution') : null;
}

function candidateName(buffer: readonly SignId[]): string | null {
  const match = matcher.match(buffer);
  if (buffer.length === 0) return null;
  if (match.status === 'complete')
    return isRosterJutsuId(match.jutsu.id) ? CONTENT.jutsus[match.jutsu.id].name : null;
  if (match.status === 'prefix' && match.candidates.length === 1) {
    const only = match.candidates[0];
    return only && isRosterJutsuId(only.id) ? CONTENT.jutsus[only.id].name : null;
  }
  return null;
}

export function BattlePage() {
  const session = useBattleSession();
  if (!session.setup) return <Navigate to="/play" replace />;
  return <BattleStage setup={session.setup} />;
}

function BattleStage({
  setup,
}: {
  setup: NonNullable<ReturnType<typeof useBattleSession>['setup']>;
}) {
  const session = useBattleSession();
  const settings = useSettings();
  const { user } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const [controller] = useState(() => {
    const detector = createSignDetector(setup.inputMode, settings);
    const opponent = new BotOpponent({
      difficulty: setup.difficulty,
      params: BALANCE.bot[setup.difficulty],
      roster: ROSTER,
      balance: ENGINE_BALANCE,
      displayName: `${CONTENT.bot.name} (${CONTENT.difficulties[setup.difficulty].name})`,
    });
    return new BattleController({
      balance: { ...ENGINE_BALANCE, signHoldMs: BALANCE.signHoldMs },
      roster: ROSTER,
      detector,
      opponent,
      confidenceThreshold: settings.confidenceThreshold,
    });
  });

  const phase = useControllerPhase(controller);
  const state = useEngineSnapshot(controller);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const [hitSide, setHitSide] = useState<'p1' | 'p2' | null>(null);
  const [bursts, setBursts] = useState<ClashBurst[]>([]);
  const [dodges, setDodges] = useState<DodgeMark[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const finishedRef = useRef(false);
  const frame = useFrameTick(phase !== 'ended');

  // Countdown, then start the controller.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      controller
        .start()
        .then(() => setStarted(true))
        .catch(() => undefined);
    }, BALANCE.countdownMs);
    return () => window.clearTimeout(timer);
  }, [controller]);

  useEffect(() => () => controller.stop(), [controller]);

  // Camera for the self panel; optional in keyboard mode.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attachVideo = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
  }, []);
  const { state: camera } = useCamera({ deviceId: settings.cameraDeviceId, enabled: true });
  const stream = camera.status === 'ready' ? camera.stream : null;
  const tracker = useHandTracker(videoRef, stream, camera.status === 'ready');

  // Transient effects from engine events.
  useEngineEvent(controller, 'hit', (event) => {
    setHitSide(event.target);
    window.setTimeout(() => setHitSide(null), HIT_FLASH_MS);
    const who = event.target === 'p1' ? 'You' : controller.opponent.displayName;
    setAnnouncement(`${who} took ${event.damage} damage. ${event.hpAfter} HP left.`);
  });
  useEngineEvent(controller, 'clash', (event) => {
    const leftIsA = event.a.caster === 'p1';
    const projectiles = controller.getState().inFlight;
    const elementOf = (id: number, fallback: 'fire') =>
      projectiles.find((p) => p.id === id)?.element ?? fallback;
    const burst: ClashBurst = {
      id: event.t + event.a.projectileId,
      at: event.t,
      left: {
        multiplier: leftIsA ? event.a.multiplier : event.b.multiplier,
        element: elementOf(leftIsA ? event.a.projectileId : event.b.projectileId, 'fire'),
      },
      right: {
        multiplier: leftIsA ? event.b.multiplier : event.a.multiplier,
        element: elementOf(leftIsA ? event.b.projectileId : event.a.projectileId, 'fire'),
      },
    };
    setBursts((current) => [...current, burst]);
    window.setTimeout(
      () => setBursts((current) => current.filter((b) => b.id !== burst.id)),
      BURST_MS,
    );
  });
  useEngineEvent(controller, 'dodge', (event) => {
    const mark: DodgeMark = { id: event.t, at: event.t, player: event.player };
    setDodges((current) => [...current, mark]);
    window.setTimeout(
      () => setDodges((current) => current.filter((d) => d.id !== mark.id)),
      DODGE_MS,
    );
  });

  // End of match: show the result word, then hand off to the results page.
  useEffect(() => {
    if (phase !== 'ended' || finishedRef.current) return;
    const final = controller.getState();
    if (!final.result) return;
    finishedRef.current = true;
    const timer = window.setTimeout(() => {
      session.finish(buildOutcome(final, controller.localPlayer));
      void navigate('/play/results', { replace: true });
    }, BALANCE.resultHoldMs);
    return () => window.clearTimeout(timer);
  }, [phase, controller, session, navigate]);

  // Escape pauses.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !started || phase === 'ended') return;
      event.preventDefault();
      controller.pause();
      setPaused(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controller, started, phase]);

  const resume = () => {
    setConfirmForfeit(false);
    setPaused(false);
    controller.resume();
  };

  const forfeit = () => {
    setConfirmForfeit(false);
    setPaused(false);
    controller.forfeit();
  };

  const now = state?.now ?? 0;
  const me = state?.players.p1;
  const them = state?.players.p2;
  const hold = controller.getHold();
  const elapsedSinceCountdown = frame.elapsed;
  const countdownRemaining = BALANCE.countdownMs - elapsedSinceCountdown;
  const stageStyle = useMemo(
    () => ({ '--dur-flight': `${BALANCE.flightMs}ms` }) as CSSProperties,
    [],
  );
  const myName = user?.username ?? 'You';
  const opponentName = controller.opponent.displayName;
  const fading = (updatedAt: number | null) =>
    updatedAt !== null && updatedAt + BALANCE.bufferResetMs - now < 500;

  return (
    <main className={styles.stage} style={stageStyle}>
      <div className={styles.top}>
        <HpBar
          side="left"
          hp={me?.hp ?? BALANCE.maxHp}
          maxHp={BALANCE.maxHp}
          name={`${myName}, ${CONTENT.difficulties[setup.difficulty].name} opponent`}
        />
        <Timer remainingMs={state ? state.endsAt - now : BALANCE.roundDurationMs} />
        <HpBar
          side="right"
          hp={them?.hp ?? BALANCE.maxHp}
          maxHp={BALANCE.maxHp}
          name={opponentName}
        />
      </div>

      <FlightStrip
        projectiles={state?.inFlight ?? []}
        now={now}
        flightMs={BALANCE.flightMs}
        localPlayer="p1"
        bursts={bursts}
        dodges={dodges}
        reducedMotion={reducedMotion}
      />

      <div className={styles.panels}>
        <VideoPanel
          stream={stream}
          state={
            camera.status === 'error' ? 'error' : camera.status === 'ready' ? 'live' : 'loading'
          }
          label={myName}
          mirror={settings.mirrorVideo}
          onVideoElement={attachVideo}
          overlay={{ frameRef: tracker.frameRef, show: settings.showLandmarks }}
          hit={hitSide === 'p1'}
          error={{
            title: setup.inputMode === 'keyboard' ? 'Keyboard mode' : 'Camera unavailable',
            body:
              setup.inputMode === 'keyboard'
                ? 'Your camera is off or unavailable. Keys still work.'
                : camera.status === 'error'
                  ? camera.error.message
                  : '',
          }}
        >
          <DetectionReadout
            sign={hold.sign}
            confidence={hold.confidence}
            holdFraction={hold.fraction}
            idleText={setup.inputMode === 'keyboard' ? 'Hold a key' : 'No sign'}
          />
        </VideoPanel>

        <div className={styles.centre}>
          <CooldownSeal
            readyAt={me?.substitutionReadyAt ?? 0}
            now={now}
            cooldownMs={BALANCE.substitutionCooldownMs}
          />
        </div>

        <VideoPanel
          stream={controller.opponent.mediaStream}
          state="no-stream"
          label={opponentName}
          avatar={<BotAvatar difficulty={setup.difficulty} name={opponentName} />}
          hit={hitSide === 'p2'}
        />
      </div>

      <div className={styles.trails}>
        <div className={styles.trailColumn}>
          <SignTrail
            buffer={me?.buffer ?? []}
            direction="ltr"
            element={openerElement(me?.buffer ?? [])}
            candidate={candidateName(me?.buffer ?? [])}
            fading={fading(me?.bufferUpdatedAt ?? null)}
            label="Your signs"
          />
          {setup.inputMode === 'keyboard' ? (
            <KeyMap bindings={settings.keyBindings} held={hold.sign} compact />
          ) : null}
        </div>
        <div />
        <SignTrail
          buffer={them?.buffer ?? []}
          direction="rtl"
          element={openerElement(them?.buffer ?? [])}
          fading={fading(them?.bufferUpdatedAt ?? null)}
          label="Opponent signs"
        />
      </div>

      {!started && phase !== 'ended' ? (
        <CountdownOverlay remainingMs={countdownRemaining} fightWordMs={FIGHT_WORD_MS} />
      ) : null}
      {started && countdownRemaining > -FIGHT_WORD_MS ? (
        <CountdownOverlay
          remainingMs={Math.min(0, countdownRemaining)}
          fightWordMs={FIGHT_WORD_MS}
        />
      ) : null}
      {phase === 'ended' && state?.result ? (
        <ResultWord
          result={
            state.result.winner === null ? 'draw' : state.result.winner === 'p1' ? 'win' : 'loss'
          }
        />
      ) : null}

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>

      <Dialog
        open={paused}
        title="Paused"
        destructive
        onClose={resume}
        actions={
          confirmForfeit ? (
            <>
              <Button onClick={() => setConfirmForfeit(false)}>Keep fighting</Button>
              <Button variant="danger" onClick={forfeit}>
                Forfeit the match
              </Button>
            </>
          ) : (
            <>
              <Button variant="danger" onClick={() => setConfirmForfeit(true)}>
                Forfeit
              </Button>
              <Button variant="primary" onClick={resume}>
                Resume
              </Button>
            </>
          )
        }
      >
        {confirmForfeit ? 'Forfeiting counts as a loss.' : 'The bot waits while this is open.'}
      </Dialog>
    </main>
  );
}
