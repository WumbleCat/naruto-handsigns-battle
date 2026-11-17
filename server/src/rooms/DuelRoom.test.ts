// Two real clients against a booted Colyseus server: seats, lobby, movement sanitising, tampered
// messages, dodge and sign messages, reconnection grace and forfeit, timeout results.
// Timings are shortened through the labelled test option (DUEL_ALLOW_TEST_TIMINGS).
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room as ClientRoom } from '@colyseus/sdk';
import {
  CLIENT_MESSAGES,
  DUEL_CONFIG,
  DUEL_ROOM_NAME,
  MoveInput,
  SERVER_MESSAGES,
  type ActionRejectedMessage,
  type GameEventMessage,
  type MatchResultMessage,
} from '@jutsu-duel/duel-shared';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DuelRoom as DuelRoomInstance } from './DuelRoom.ts';

vi.hoisted(() => {
  process.env.DUEL_ALLOW_TEST_TIMINGS = 'true';
});

const { createDuelServer } = await import('../index.ts');

const PORT = 2599;
const FAST = {
  testTimings: {
    countdownMs: 200,
    resumeCountdownMs: 100,
    durationMs: 3000,
    reconnectGraceMs: 1200,
  },
};

let colyseus: ColyseusTestServer;
const open: ClientRoom[] = [];

beforeAll(async () => {
  colyseus = await boot(createDuelServer(), PORT);
});

afterAll(async () => {
  await colyseus.shutdown();
});

afterEach(async () => {
  for (const room of open.splice(0)) {
    try {
      await room.leave(true);
    } catch {
      // already gone
    }
  }
  await colyseus.cleanup();
});

async function until(
  condition: () => boolean,
  timeoutMs = 5000,
  label = 'condition',
): Promise<void> {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createDuel(options: object = FAST) {
  const room = await colyseus.createRoom<DuelRoomInstance>(DUEL_ROOM_NAME, options);
  return room;
}

async function connect(room: DuelRoomInstance, nickname: string): Promise<ClientRoom> {
  const client = await colyseus.connectTo(room, { nickname });
  open.push(client);
  return client;
}

async function startMatch(room: DuelRoomInstance) {
  const a = await connect(room, 'Alpha');
  const b = await connect(room, 'Beta');
  a.send(CLIENT_MESSAGES.READY, { ready: true });
  b.send(CLIENT_MESSAGES.READY, { ready: true });
  await until(() => room.simulation.phase === 'PLAYING', 4000, 'PLAYING');
  return { a, b };
}

function collect<T>(client: ClientRoom, type: string): T[] {
  const received: T[] = [];
  client.onMessage(type, (payload: T) => received.push(payload));
  return received;
}

describe('DuelRoom', () => {
  it('seats two players, rejects a third, and never starts solo (U-19, U-25)', async () => {
    const room = await createDuel();
    const a = await connect(room, 'Alpha');
    await until(() => room.simulation.players.length === 1);
    a.send(CLIENT_MESSAGES.READY, { ready: true });
    await sleep(400);
    expect(room.simulation.phase).toBe('WAITING');

    await connect(room, 'Beta');
    await until(() => room.simulation.players.length === 2);
    await expect(colyseus.connectTo(room, { nickname: 'Gamma' })).rejects.toThrow();
    expect(room.simulation.players.map((p) => p.nickname)).toEqual(['Alpha', 'Beta']);
  });

  it('rejects a join without a valid nickname', async () => {
    const room = await createDuel();
    await expect(colyseus.connectTo(room, { nickname: '' })).rejects.toThrow();
    await expect(colyseus.connectTo(room, {})).rejects.toThrow();
    expect(room.simulation.players).toHaveLength(0);
  });

  it('runs the countdown when both are ready and both clients see the same state (U-03, U-27)', async () => {
    const room = await createDuel();
    const { a, b } = await startMatch(room);
    await a.waitForNextPatch();
    await b.waitForNextPatch();
    const stateA = a.state as {
      phase: string;
      players: Map<string, { nickname: string; hp: number }>;
    };
    const stateB = b.state as {
      phase: string;
      players: Map<string, { nickname: string; hp: number }>;
    };
    expect(stateA.phase).toBe('PLAYING');
    expect(stateB.phase).toBe('PLAYING');
    expect([...stateA.players.values()].map((p) => p.nickname).sort()).toEqual(['Alpha', 'Beta']);
    expect([...stateB.players.values()].map((p) => p.hp)).toEqual([100, 100]);
  });

  it('ignores tampered or unknown messages (U-20)', async () => {
    const room = await createDuel();
    const { a } = await startMatch(room);
    const before = JSON.stringify(room.simulation.players.map((p) => [p.hp, p.x, p.chakra]));
    a.send('SET_HP', { hp: 0 });
    a.send('TELEPORT', { x: 1000, y: 10 });
    a.send(CLIENT_MESSAGES.READY, { ready: 'yes' });
    a.send(CLIENT_MESSAGES.SIGN, {
      sign: 'dragon',
      confidence: 2,
      eventId: 'x',
      clientObservedMs: -1,
    });
    a.send(CLIENT_MESSAGES.DODGE_REQUEST, { actionId: '' });
    await sleep(150);
    expect(room.simulation.phase).toBe('PLAYING');
    const hpAndChakra = room.simulation.players.map((p) => [p.hp, p.chakra]);
    expect(hpAndChakra).toEqual([
      [100, 100],
      [100, 100],
    ]);
    expect(JSON.stringify(room.simulation.players.map((p) => [p.hp, p.x, p.chakra]))).toBe(before);
  });

  it('clamps movement input so nobody moves faster than the configured speed (U-29)', async () => {
    const room = await createDuel();
    const { a } = await startMatch(room);
    const player = room.simulation.players[0];
    if (!player) throw new Error('no player');
    const startX = player.x;
    const input = a.input({ type: MoveInput });
    const sendFor = async (ms: number) => {
      const until = Date.now() + ms;
      while (Date.now() < until) {
        input.data.moveX = 9999;
        input.data.moveY = 0;
        input.send();
        await sleep(1000 / DUEL_CONFIG.tickRate);
      }
    };
    await sendFor(400);
    await sleep(60);
    const moved = player.x - startX;
    expect(moved).toBeGreaterThan(30);
    expect(moved).toBeLessThanOrEqual(DUEL_CONFIG.player.speed * 0.5 + 1);
  });

  it('applies a dodge once per action id and rejects the repeat (U-08, U-28)', async () => {
    const room = await createDuel();
    const { a } = await startMatch(room);
    const rejected = collect<ActionRejectedMessage>(a, SERVER_MESSAGES.ACTION_REJECTED);
    const events = collect<GameEventMessage>(a, SERVER_MESSAGES.GAME_EVENT);
    a.send(CLIENT_MESSAGES.DODGE_REQUEST, { actionId: 'dodge-1' });
    a.send(CLIENT_MESSAGES.DODGE_REQUEST, { actionId: 'dodge-1' });
    await until(() => rejected.length > 0, 2000, 'rejection');
    expect(rejected[0]).toMatchObject({ action: 'dodge', reason: 'duplicate' });
    expect(events.filter((e) => e.type === 'DODGE_STARTED')).toHaveLength(1);
    const player = room.simulation.players[0];
    expect(player?.stamina).toBeLessThanOrEqual(65);
    expect(player?.stats.dodgesUsed).toBe(1);
  });

  it('casts Fireball through the SIGN pipeline and lands it for 28 damage (U-12)', async () => {
    const room = await createDuel();
    const { a, b } = await startMatch(room);
    const events = collect<GameEventMessage>(a, SERVER_MESSAGES.GAME_EVENT);
    const eventsB = collect<GameEventMessage>(b, SERVER_MESSAGES.GAME_EVENT);
    // Walk the players close enough for a fireball to reach.
    const [alpha, beta] = room.simulation.players;
    if (!alpha || !beta) throw new Error('players missing');
    alpha.x = 400;
    beta.x = 700;
    for (const [i, sign] of ['tiger', 'boar', 'horse'].entries()) {
      a.send(CLIENT_MESSAGES.SIGN, {
        sign,
        confidence: 0.95,
        eventId: `s${i}`,
        clientObservedMs: i * 150,
      });
      await sleep(150);
    }
    await until(() => events.some((e) => e.type === 'HIT'), 3000, 'HIT');
    const hit = events.find((e) => e.type === 'HIT');
    expect(hit).toMatchObject({ targetId: b.sessionId, data: { damage: 28, dodged: false } });
    expect(beta.hp).toBe(72);
    expect(alpha.stats.casts.fireball).toBe(1);
    expect(alpha.chakra).toBeLessThan(85); // 30 spent, a little regenerated since
    expect(eventsB.some((e) => e.type === 'CAST_STARTED')).toBe(true);
  });

  it('rejects a wrong sign and a too-fast sign without spending anything (U-13)', async () => {
    const room = await createDuel();
    const { a } = await startMatch(room);
    const rejected = collect<ActionRejectedMessage>(a, SERVER_MESSAGES.ACTION_REJECTED);
    a.send(CLIENT_MESSAGES.SIGN, {
      sign: 'tiger',
      confidence: 0.95,
      eventId: 'w1',
      clientObservedMs: 0,
    });
    a.send(CLIENT_MESSAGES.SIGN, {
      sign: 'boar',
      confidence: 0.95,
      eventId: 'w2',
      clientObservedMs: 10,
    });
    await until(() => rejected.length > 0, 2000, 'rejection');
    expect(rejected[0]).toMatchObject({ action: 'sign', reason: 'sign_too_fast' });
    await sleep(150);
    a.send(CLIENT_MESSAGES.SIGN, {
      sign: 'ram',
      confidence: 0.95,
      eventId: 'w3',
      clientObservedMs: 200,
    });
    await until(() => rejected.length > 1, 2000, 'second rejection');
    expect(rejected[1]).toMatchObject({ action: 'sign', reason: 'wrong_sign' });
    expect(room.simulation.players[0]?.chakra).toBe(100);
    expect(room.simulation.players[0]?.signIndex).toBe(0);
  });

  it('pauses on a drop, resumes after a reconnect, and forfeits on a second drop (U-21, U-23)', async () => {
    const room = await createDuel();
    const { a } = await startMatch(room);
    const token = a.reconnectionToken;
    await a.leave(false);
    open.splice(open.indexOf(a), 1);
    await until(() => room.simulation.phase === 'PAUSED_RECONNECT', 2000, 'pause');
    const frozenTick = room.simulation.tick;
    await sleep(200);
    expect(room.simulation.tick).toBe(frozenTick);

    const back = await colyseus.sdk.reconnect(token);
    open.push(back);
    await until(() => room.simulation.phase === 'PLAYING', 3000, 'resume');
    expect(room.simulation.players.find((p) => p.id === back.sessionId)?.connected).toBe(true);

    await back.leave(false);
    open.splice(open.indexOf(back), 1);
    await until(() => room.simulation.phase === 'FINISHED', 2000, 'forfeit');
    expect(room.simulation.resultReason).toBe('forfeit');
    expect(room.simulation.winnerId).not.toBe(back.sessionId);
  });

  it('forfeits when the grace period runs out (U-22)', async () => {
    const room = await createDuel();
    const { a, b } = await startMatch(room);
    const results = collect<MatchResultMessage>(b, SERVER_MESSAGES.MATCH_RESULT);
    await a.leave(false);
    open.splice(open.indexOf(a), 1);
    await until(() => room.simulation.phase === 'FINISHED', 4000, 'forfeit after grace');
    expect(room.simulation.winnerId).toBe(b.sessionId);
    await until(() => results.length > 0, 2000, 'result message');
    expect(results[0]).toMatchObject({ winnerId: b.sessionId, reason: 'forfeit' });
  }, 10_000);

  it('ends by timeout with equal HP as a draw and offers a rematch that resets everything (U-18, U-24)', async () => {
    const room = await createDuel();
    const { a, b } = await startMatch(room);
    const resultsA = collect<MatchResultMessage>(a, SERVER_MESSAGES.MATCH_RESULT);
    const resultsB = collect<MatchResultMessage>(b, SERVER_MESSAGES.MATCH_RESULT);
    await until(() => room.simulation.phase === 'FINISHED', 6000, 'timeout');
    await until(() => resultsA.length > 0 && resultsB.length > 0, 2000, 'results');
    expect(resultsA[0]).toMatchObject({ reason: 'draw', winnerId: '' });
    expect(resultsB[0]?.players.map((p) => p.hpLeft)).toEqual([100, 100]);

    a.send(CLIENT_MESSAGES.REMATCH_VOTE, { accept: true });
    b.send(CLIENT_MESSAGES.REMATCH_VOTE, { accept: true });
    await until(
      () => room.simulation.phase === 'COUNTDOWN' || room.simulation.phase === 'PLAYING',
      3000,
      'rematch',
    );
    expect(room.simulation.winnerId).toBe('');
    expect(room.simulation.players.every((p) => p.hp === 100 && p.chakra === 100)).toBe(true);
  }, 15_000);
});
