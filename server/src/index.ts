// Colyseus server bootstrap for the online duel. One process hosts many rooms; each room is a
// private two-seat match found by its room id (the invite code).
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { DUEL_ROOM_NAME } from '@jutsu-duel/duel-shared';
import { DuelRoom, TEST_TIMINGS_ALLOWED } from './rooms/DuelRoom.ts';

export function createDuelServer(): Server {
  const server = new Server({
    transport: new WebSocketTransport(),
    greet: false,
    express: (app) => {
      app.get('/health', (_req: unknown, res: { json: (body: unknown) => void }) => {
        res.json({ ok: true, room: DUEL_ROOM_NAME });
      });
    },
  });
  server.define(DUEL_ROOM_NAME, DuelRoom);
  return server;
}

const port = Number(process.env.DUEL_SERVER_PORT ?? process.env.PORT ?? 2567);
const entry = process.argv[1]?.replace(/\\/g, '/') ?? '';

if (import.meta.url.endsWith(entry.slice(entry.lastIndexOf('/')))) {
  const server = createDuelServer();
  server
    .listen(port)
    .then(() => {
      console.log(`[duel] listening on ws://localhost:${port}`);
      if (TEST_TIMINGS_ALLOWED)
        console.log('[duel] test timings are enabled (DUEL_ALLOW_TEST_TIMINGS)');
    })
    .catch((error: unknown) => {
      console.error('[duel] failed to start', error);
      process.exit(1);
    });
}
