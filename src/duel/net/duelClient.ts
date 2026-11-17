// Connection helpers for the online duel. One Colyseus SDK client per tab; rooms are created
// or joined by id (the invite code) and remembered in sessionStorage so a reload can reconnect
// with the private token instead of taking a fresh seat.
import { Client, type Room } from '@colyseus/sdk';
import { DUEL_ROOM_NAME, type DuelNetState, type InputMode } from '@jutsu-duel/duel-shared';

export type DuelRoom = Room<unknown, DuelNetState>;

export interface DuelIdentity {
  nickname: string;
  inputMode: InputMode;
}

const DEFAULT_PORT = 2567;
const SESSION_KEY = 'jutsu-duel.duel-session';
const IDENTITY_KEY = 'jutsu-duel.duel-identity';

export function duelServerUrl(): string {
  const configured = import.meta.env.VITE_DUEL_SERVER_URL as string | undefined;
  if (configured && configured.length > 0) return configured;
  const secure = window.location.protocol === 'https:';
  return `${secure ? 'wss' : 'ws'}://${window.location.hostname}:${DEFAULT_PORT}`;
}

let client: Client | null = null;

function sdk(): Client {
  client ??= new Client(duelServerUrl());
  return client;
}

export function createDuelRoom(identity: DuelIdentity): Promise<DuelRoom> {
  return sdk().create<DuelNetState>(DUEL_ROOM_NAME, identity);
}

export function joinDuelRoom(roomId: string, identity: DuelIdentity): Promise<DuelRoom> {
  return sdk().joinById<DuelNetState>(roomId, identity);
}

export function reconnectDuelRoom(token: string): Promise<DuelRoom> {
  return sdk().reconnect<DuelNetState>(token);
}

interface StoredSession extends DuelIdentity {
  roomId: string;
  token: string;
}

function safeStorage(area: 'session' | 'local'): Storage | null {
  try {
    return area === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function rememberSession(room: DuelRoom, identity: DuelIdentity): void {
  const stored: StoredSession = { roomId: room.roomId, token: room.reconnectionToken, ...identity };
  safeStorage('session')?.setItem(SESSION_KEY, JSON.stringify(stored));
}

export function recallSession(roomId: string): StoredSession | null {
  try {
    const raw = safeStorage('session')?.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (parsed.roomId !== roomId || typeof parsed.token !== 'string') return null;
    return {
      roomId,
      token: parsed.token,
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname : 'Player',
      inputMode: parsed.inputMode === 'webcam' ? 'webcam' : 'mock',
    };
  } catch {
    return null;
  }
}

export function forgetSession(): void {
  safeStorage('session')?.removeItem(SESSION_KEY);
}

export function loadIdentity(): DuelIdentity {
  try {
    const raw = safeStorage('local')?.getItem(IDENTITY_KEY);
    if (!raw) return { nickname: '', inputMode: 'mock' };
    const parsed = JSON.parse(raw) as Partial<DuelIdentity>;
    return {
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname.slice(0, 16) : '',
      inputMode: parsed.inputMode === 'webcam' ? 'webcam' : 'mock',
    };
  } catch {
    return { nickname: '', inputMode: 'mock' };
  }
}

export function saveIdentity(identity: DuelIdentity): void {
  safeStorage('local')?.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

/**
 * A room created on the home page is handed to the room page through this slot, so the
 * creator keeps the connection it already has instead of joining its own room twice.
 */
let handoff: { roomId: string; room: DuelRoom } | null = null;

export function handOffRoom(room: DuelRoom): void {
  handoff = { roomId: room.roomId, room };
}

export function takeHandedOffRoom(roomId: string): DuelRoom | null {
  if (handoff?.roomId !== roomId) return null;
  const room = handoff.room;
  handoff = null;
  return room;
}

/** Turns an SDK error into a sentence the player can act on. */
export function describeJoinError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes('full') || lower.includes('locked')) return 'That duel is full.';
  if (lower.includes('already started')) return 'That duel has already started.';
  if (
    lower.includes('not found') ||
    lower.includes('no room') ||
    lower.includes('does not exist')
  ) {
    return 'No duel has that code. Check it and try again.';
  }
  if (lower.includes('nickname')) return 'Choose a nickname of 1 to 16 characters.';
  if (lower.includes('fetch') || lower.includes('network') || lower.includes('econnrefused')) {
    return `Could not reach the duel server at ${duelServerUrl()}. Is it running?`;
  }
  return message || 'Could not join the duel.';
}
