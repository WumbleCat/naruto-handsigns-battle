// Keeps one live connection per room id across React re-mounts. React StrictMode mounts,
// unmounts and mounts again in development; leaving the room on that first unmount would
// forfeit a seat, so a release only schedules the leave and a quick re-acquire cancels it.
import type { DuelRoom } from './duelClient';

interface Entry {
  promise: Promise<DuelRoom>;
  room: DuelRoom | null;
  refs: number;
  releaseTimer: number | null;
}

const RELEASE_GRACE_MS = 1500;
const entries = new Map<string, Entry>();

export function acquireRoom(roomId: string, connect: () => Promise<DuelRoom>): Promise<DuelRoom> {
  let entry = entries.get(roomId);
  if (!entry) {
    const created: Entry = {
      promise: Promise.resolve(null as unknown as DuelRoom),
      room: null,
      refs: 0,
      releaseTimer: null,
    };
    created.promise = connect().then(
      (room) => {
        created.room = room;
        room.onLeave(() => {
          if (entries.get(roomId) === created) entries.delete(roomId);
        });
        return room;
      },
      (error: unknown) => {
        if (entries.get(roomId) === created) entries.delete(roomId);
        throw error;
      },
    );
    entries.set(roomId, created);
    entry = created;
  }
  entry.refs += 1;
  if (entry.releaseTimer !== null) {
    window.clearTimeout(entry.releaseTimer);
    entry.releaseTimer = null;
  }
  return entry.promise;
}

export function releaseRoom(roomId: string): void {
  const entry = entries.get(roomId);
  if (!entry) return;
  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs > 0) return;
  entry.releaseTimer = window.setTimeout(() => {
    if (entries.get(roomId) !== entry || entry.refs > 0) return;
    entries.delete(roomId);
    void entry.room?.leave(true);
  }, RELEASE_GRACE_MS);
}

/** Leaves now, on purpose (the player clicked Leave). */
export async function dropRoom(roomId: string): Promise<void> {
  const entry = entries.get(roomId);
  if (!entry) return;
  entries.delete(roomId);
  if (entry.releaseTimer !== null) window.clearTimeout(entry.releaseTimer);
  const room = entry.room ?? (await entry.promise.catch(() => null));
  await room?.leave(true);
}
