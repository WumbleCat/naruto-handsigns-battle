import { DT_MS, DUEL_CONFIG, JUTSUS, type GameEventMessage } from '@jutsu-duel/duel-shared';
import { describe, expect, it } from 'vitest';
import {
  LOCAL_BOT_ID,
  LOCAL_PLAYER_ID,
  LocalDuelMatch,
  type LocalMatchMessage,
} from './LocalDuelMatch';

const FAST = { countdownMs: 100 };

function start(level: 'easy' | 'normal' | 'hard' = 'easy', seed = 1) {
  const match = new LocalDuelMatch({ nickname: 'Tester', level, seed, timings: FAST });
  const messages: LocalMatchMessage[] = [];
  match.subscribe((message) => messages.push(message));
  return { match, messages };
}

function stepUntil(match: LocalDuelMatch, phase: string, maxTicks = 200 * 30): void {
  for (let i = 0; i < maxTicks && match.state.phase !== phase; i += 1) match.step();
  expect(match.state.phase).toBe(phase);
}

/** Weaves the selected jutsu with a legal gap between signs. Returns the clock after it. */
function weave(match: LocalDuelMatch, signs: readonly string[], fromMs: number): number {
  let now = fromMs;
  for (const sign of signs) {
    match.sendSign(sign as never, 1, now);
    now += 300;
  }
  return now;
}

describe('LocalDuelMatch', () => {
  it('seats the player and the named bot, counts down, then plays', () => {
    const { match, messages } = start('hard');
    expect(match.state.phase).toBe('COUNTDOWN');
    expect(match.state.players.get(LOCAL_PLAYER_ID)?.nickname).toBe('Tester');
    expect(match.state.players.get(LOCAL_BOT_ID)?.nickname).toBe('Hard bot');
    stepUntil(match, 'PLAYING');
    expect(messages.some((m) => m.type === 'event' && m.event.type === 'MATCH_STARTED')).toBe(true);
  });

  it('moves the player by the held direction through the shared walk step', () => {
    const { match } = start();
    stepUntil(match, 'PLAYING');
    const before = match.state.players.get(LOCAL_PLAYER_ID)?.x ?? 0;
    match.setMove(1, 0);
    for (let i = 0; i < 30; i += 1) match.step();
    const after = match.state.players.get(LOCAL_PLAYER_ID)?.x ?? 0;
    expect(after - before).toBeCloseTo(DUEL_CONFIG.player.speed, 3);
  });

  it('casts for the player through the sign rules and reports progress', () => {
    const { match, messages } = start();
    stepUntil(match, 'PLAYING');
    weave(match, JUTSUS.fireball.signs, 1000);
    const progress = messages.flatMap((m) => (m.type === 'progress' ? [m.progress.index] : []));
    // The last sign starts the cast and clears the sequence, as it does online.
    expect(progress).toEqual([1, 2, 0]);
    const cast = messages.find((m) => m.type === 'event' && m.event.type === 'CAST_STARTED');
    expect(cast).toBeDefined();
    expect(match.state.players.get(LOCAL_PLAYER_ID)?.chakra).toBe(100 - JUTSUS.fireball.chakra);
  });

  it('rejects what the rules reject, in the server message shape', () => {
    const { match, messages } = start();
    match.requestDodge();
    expect(messages.at(-1)).toMatchObject({
      type: 'rejected',
      rejection: { action: 'dodge', reason: 'not_playing' },
    });
    stepUntil(match, 'PLAYING');
    match.sendSign('tiger', 1, 1000);
    match.sendSign('boar', 1, 1050);
    expect(messages.at(-2)).toMatchObject({
      type: 'rejected',
      rejection: { action: 'sign', reason: 'sign_too_fast' },
    });
    match.sendSign('boar', 0.5, 2000);
    expect(messages.at(-1)).toMatchObject({ type: 'rejected', rejection: { reason: 'invalid' } });
  });

  it('dodges in the held direction', () => {
    const { match, messages } = start();
    stepUntil(match, 'PLAYING');
    match.setMove(0, 1);
    match.requestDodge();
    const dodge = messages.find((m) => m.type === 'event' && m.event.type === 'DODGE_STARTED');
    expect(dodge && dodge.type === 'event' ? dodge.event.data : null).toMatchObject({
      dirX: 0,
      dirY: 1,
    });
    expect(match.state.players.get(LOCAL_PLAYER_ID)?.stamina).toBe(
      100 - DUEL_CONFIG.dodge.staminaCost,
    );
  });

  it('plays to one result with numbered events, then rematches from full bars', () => {
    const { match, messages } = start('normal', 5);
    // An idle player loses to the bot by knockout.
    stepUntil(match, 'FINISHED');
    const results = messages.filter((m) => m.type === 'result');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      type: 'result',
      result: { winnerId: LOCAL_BOT_ID, reason: 'ko' },
    });
    const events = messages.flatMap((m): GameEventMessage[] =>
      m.type === 'event' ? [m.event] : [],
    );
    expect(events.map((e) => e.eventId)).toEqual(events.map((_, i) => i + 1));
    expect(match.state.winnerId).toBe(LOCAL_BOT_ID);

    match.rematch();
    expect(messages.at(-1)).toEqual({ type: 'result', result: null });
    expect(match.state.phase).toBe('COUNTDOWN');
    expect(match.state.players.get(LOCAL_PLAYER_ID)?.hp).toBe(100);
    expect(match.state.projectiles.size).toBe(0);
    stepUntil(match, 'PLAYING');
  });

  it('advances by wall time and caps the catch-up after a stall', () => {
    const { match } = start();
    expect(match.advance(1000)).toBe(0);
    expect(match.advance(1000 + DT_MS * 2 + 1)).toBe(2);
    expect(match.advance(60_000)).toBe(5);
  });

  it('replays identically from the same seed and inputs', () => {
    const run = () => {
      const { match, messages } = start('hard', 9);
      stepUntil(match, 'PLAYING');
      match.setMove(0, 1);
      let now = 0;
      for (let i = 0; i < 900 && match.state.phase === 'PLAYING'; i += 1) {
        if (i % 90 === 0) now = weave(match, JUTSUS.fireball.signs, now + 1000);
        match.step();
      }
      return messages;
    };
    expect(run()).toEqual(run());
  });
});
