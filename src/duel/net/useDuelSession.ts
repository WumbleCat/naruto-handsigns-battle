// The React side of a duel connection: joins (or reconnects to) the room, exposes the latest
// authoritative state through a version counter that bumps on every patch, and relays the
// server's discrete messages. Combat intent is sent through the returned helpers only.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { InputHandle } from '@colyseus/sdk';
import {
  CLIENT_MESSAGES,
  MoveInput,
  SERVER_MESSAGES,
  type ActionRejectedMessage,
  type DuelNetState,
  type DuelSign,
  type GameEventMessage,
  type JutsuId,
  type MatchResultMessage,
  type RoomNoticeMessage,
  type SignProgressMessage,
} from '@jutsu-duel/duel-shared';
import {
  describeJoinError,
  forgetSession,
  joinDuelRoom,
  recallSession,
  reconnectDuelRoom,
  rememberSession,
  takeHandedOffRoom,
  type DuelIdentity,
  type DuelRoom,
} from './duelClient';
import { acquireRoom, dropRoom, releaseRoom } from './roomRegistry';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error' | 'left';

export interface DuelNotice extends RoomNoticeMessage {
  id: number;
  at: number;
}

export interface DuelSession {
  status: ConnectionStatus;
  error: string | null;
  /** The Colyseus room, or null for an offline match hosted in this tab. */
  room: DuelRoom | null;
  /** Set for an offline match: what to show where the ping would be. */
  offlineLabel: string | null;
  sessionId: string;
  state: DuelNetState | null;
  /** The latest state, for the render loop to read outside React's render cycle. */
  getState: () => DuelNetState | null;
  /** Sends this tick's movement intent and returns its sequence number. */
  sendMove: (moveX: number, moveY: number) => number;
  /** The newest movement sequence number the host has applied. */
  lastProcessedInput: () => number;
  /** Increments on every state patch, so dependants re-render at the patch rate. */
  version: number;
  notices: DuelNotice[];
  rejection: ActionRejectedMessage | null;
  result: MatchResultMessage | null;
  progress: SignProgressMessage | null;
  leaveReason: string | null;
  subscribeEvents: (listener: (event: GameEventMessage) => void) => () => void;
  setReady: (ready: boolean) => void;
  requestDodge: () => void;
  selectJutsu: (jutsuId: JutsuId) => void;
  sendSign: (sign: DuelSign, confidence: number, observedMs: number) => void;
  cancelSigns: () => void;
  voteRematch: (accept: boolean) => void;
  leave: () => Promise<void>;
}

const inputHandles = new WeakMap<DuelRoom, InputHandle<MoveInput>>();

/** Native input channel: one handle per room, acked through lastProcessed. */
function inputHandleFor(room: DuelRoom): InputHandle<MoveInput> {
  let handle = inputHandles.get(room);
  if (!handle) {
    handle = room.input<MoveInput>({ type: MoveInput, historySize: 64 });
    inputHandles.set(room, handle);
  }
  return handle;
}

let nextId = 1;

function uniqueId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${Date.now().toString(36)}-${nextId}`;
}

export function useDuelSession(roomId: string, identity: DuelIdentity | null): DuelSession {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<DuelRoom | null>(null);
  const [version, setVersion] = useState(0);
  const [notices, setNotices] = useState<DuelNotice[]>([]);
  const [rejection, setRejection] = useState<ActionRejectedMessage | null>(null);
  const [result, setResult] = useState<MatchResultMessage | null>(null);
  const [progress, setProgress] = useState<SignProgressMessage | null>(null);
  const [leaveReason, setLeaveReason] = useState<string | null>(null);
  const eventListeners = useRef(new Set<(event: GameEventMessage) => void>());
  const nickname = identity?.nickname ?? null;
  const inputMode = identity?.inputMode ?? 'mock';

  useEffect(() => {
    let cancelled = false;
    const unsubscribers: Array<() => void> = [];

    const connect = async (): Promise<DuelRoom> => {
      const handed = takeHandedOffRoom(roomId);
      if (handed) return handed;
      const stored = recallSession(roomId);
      if (stored) {
        try {
          return await reconnectDuelRoom(stored.token);
        } catch {
          forgetSession();
        }
      }
      if (!nickname) throw new Error('nickname required');
      return joinDuelRoom(roomId, { nickname, inputMode });
    };

    acquireRoom(roomId, connect)
      .then((joined) => {
        if (cancelled) return;
        const stored = recallSession(roomId);
        rememberSession(joined, {
          nickname: nickname ?? stored?.nickname ?? 'Player',
          inputMode: stored?.inputMode ?? inputMode,
        });
        setRoom(joined);
        setStatus('connected');
        setError(null);

        const onState = () => setVersion((v) => v + 1);
        joined.onStateChange(onState);
        unsubscribers.push(() => joined.onStateChange.remove(onState));

        unsubscribers.push(
          joined.onMessage(SERVER_MESSAGES.GAME_EVENT, (event: GameEventMessage) => {
            for (const listener of eventListeners.current) listener(event);
          }),
          joined.onMessage(SERVER_MESSAGES.ACTION_REJECTED, (message: ActionRejectedMessage) => {
            setRejection(message);
          }),
          joined.onMessage(SERVER_MESSAGES.SIGN_PROGRESS, (message: SignProgressMessage) => {
            setProgress(message);
          }),
          joined.onMessage(SERVER_MESSAGES.MATCH_RESULT, (message: MatchResultMessage) => {
            setResult(message);
          }),
          joined.onMessage(SERVER_MESSAGES.ROOM_NOTICE, (message: RoomNoticeMessage) => {
            if (message.code === 'resuming') setResult(null);
            setNotices((current) => [
              ...current.slice(-4),
              { ...message, id: nextId++, at: Date.now() },
            ]);
          }),
        );

        const onDrop = () => setStatus('reconnecting');
        const onReconnect = () => setStatus('connected');
        const onLeave = (code: number, reason?: string) => {
          setStatus('left');
          setLeaveReason(reason ?? (code === 1000 ? null : `Connection closed (${code}).`));
          forgetSession();
        };
        joined.onDrop(onDrop);
        joined.onReconnect(onReconnect);
        joined.onLeave(onLeave);
        unsubscribers.push(
          () => joined.onDrop.remove(onDrop),
          () => joined.onReconnect.remove(onReconnect),
          () => joined.onLeave.remove(onLeave),
        );
        setVersion((v) => v + 1);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(describeJoinError(reason));
        setStatus('error');
      });

    return () => {
      cancelled = true;
      for (const off of unsubscribers) off();
      releaseRoom(roomId);
    };
  }, [roomId, nickname, inputMode]);

  const subscribeEvents = useCallback((listener: (event: GameEventMessage) => void) => {
    const listeners = eventListeners.current;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const send = useCallback(
    (type: string, payload?: unknown) => {
      if (!room || status === 'left' || status === 'error') return;
      room.send(type, payload);
    },
    [room, status],
  );

  const getState = useCallback(() => (room ? room.state : null), [room]);
  const sendMove = useCallback(
    (moveX: number, moveY: number) => {
      if (!room) return 0;
      const handle = inputHandleFor(room);
      handle.data.moveX = moveX;
      handle.data.moveY = moveY;
      return handle.send();
    },
    [room],
  );
  const lastProcessedInput = useCallback(
    () => (room ? inputHandleFor(room).lastProcessed : Number.MAX_SAFE_INTEGER),
    [room],
  );

  const leave = useCallback(async () => {
    forgetSession();
    await dropRoom(roomId);
    setStatus('left');
  }, [roomId]);

  return {
    status,
    error,
    room,
    offlineLabel: null,
    sessionId: room?.sessionId ?? '',
    state: room ? room.state : null,
    getState,
    sendMove,
    lastProcessedInput,
    version,
    notices,
    rejection,
    result,
    progress,
    leaveReason,
    subscribeEvents,
    setReady: (ready) => send(CLIENT_MESSAGES.READY, { ready }),
    requestDodge: () => send(CLIENT_MESSAGES.DODGE_REQUEST, { actionId: uniqueId('dodge') }),
    selectJutsu: (jutsuId) => send(CLIENT_MESSAGES.SELECT_JUTSU, { jutsuId }),
    sendSign: (sign, confidence, observedMs) =>
      send(CLIENT_MESSAGES.SIGN, {
        sign,
        confidence,
        eventId: uniqueId('sign'),
        clientObservedMs: observedMs,
      }),
    cancelSigns: () => send(CLIENT_MESSAGES.CANCEL_SIGNS, {}),
    voteRematch: (accept) => send(CLIENT_MESSAGES.REMATCH_VOTE, { accept }),
    leave,
  };
}
