// The offline counterpart of useDuelSession: hosts a LocalDuelMatch in this tab, drives it from
// wall time and exposes it through the same DuelSession shape, so the battle page, HUD and
// renderer are shared with the online mode.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BOT_PARAMS,
  type ActionRejectedMessage,
  type BotLevel,
  type GameEventMessage,
  type MatchResultMessage,
  type SignProgressMessage,
} from '@jutsu-duel/duel-shared';
import type { ConnectionStatus, DuelSession } from '../net/useDuelSession';
import { LOCAL_PLAYER_ID, LocalDuelMatch } from './LocalDuelMatch';

/** Twice the tick rate, so a tick is never more than half a tick late. */
const DRIVE_INTERVAL_MS = 16;
/** The HUD re-renders on every second tick, the cadence of the online state patches. */
const TICKS_PER_RENDER = 2;

function createMatch(nickname: string, level: BotLevel): LocalDuelMatch {
  return new LocalDuelMatch({ nickname, level, seed: Date.now() });
}

export function useLocalDuelSession(level: BotLevel, nickname: string): DuelSession {
  const [match] = useState(() => createMatch(nickname, level));
  const [status, setStatus] = useState<ConnectionStatus>('connected');
  const [version, setVersion] = useState(0);
  const [rejection, setRejection] = useState<ActionRejectedMessage | null>(null);
  const [result, setResult] = useState<MatchResultMessage | null>(null);
  const [progress, setProgress] = useState<SignProgressMessage | null>(null);
  const eventListeners = useRef(new Set<(event: GameEventMessage) => void>());

  useEffect(() => {
    if (status !== 'connected') return;
    const bump = () => setVersion((v) => v + 1);
    const off = match.subscribe((message) => {
      if (message.type === 'event') {
        for (const listener of eventListeners.current) listener(message.event);
      } else if (message.type === 'rejected') setRejection(message.rejection);
      else if (message.type === 'progress') setProgress(message.progress);
      else setResult(message.result);
      bump();
    });
    let sinceRender = 0;
    let phase = match.state.phase;
    const timer = window.setInterval(() => {
      sinceRender += match.advance(performance.now());
      if (sinceRender >= TICKS_PER_RENDER || match.state.phase !== phase) {
        sinceRender = 0;
        phase = match.state.phase;
        bump();
      }
    }, DRIVE_INTERVAL_MS);
    return () => {
      off();
      window.clearInterval(timer);
    };
  }, [match, status]);

  const subscribeEvents = useCallback((listener: (event: GameEventMessage) => void) => {
    const listeners = eventListeners.current;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  const getState = useCallback(() => match.state, [match]);
  const sendMove = useCallback(
    (moveX: number, moveY: number) => {
      match.setMove(moveX, moveY);
      return 0;
    },
    [match],
  );
  // Nothing is ever unacknowledged offline: the simulation is in this tab.
  const lastProcessedInput = useCallback(() => Number.MAX_SAFE_INTEGER, []);

  return {
    status,
    error: null,
    room: null,
    offlineLabel: `Offline against the ${BOT_PARAMS[level].name.toLowerCase()}`,
    sessionId: LOCAL_PLAYER_ID,
    state: match.state,
    getState,
    sendMove,
    lastProcessedInput,
    version,
    notices: [],
    rejection,
    result,
    progress,
    leaveReason: null,
    subscribeEvents,
    setReady: () => undefined,
    requestDodge: () => match.requestDodge(),
    selectJutsu: (jutsuId) => match.selectJutsu(jutsuId),
    sendSign: (sign, confidence, observedMs) => match.sendSign(sign, confidence, observedMs),
    cancelSigns: () => match.cancelSigns(),
    voteRematch: (accept) => {
      if (accept) match.rematch();
    },
    leave: () => {
      setStatus('left');
      return Promise.resolve();
    },
  };
}
