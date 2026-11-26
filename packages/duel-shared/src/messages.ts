// Builders for the messages a match host sends about a simulation. The Colyseus room and the
// offline bot match both host a DuelSim, so they share these instead of drifting apart.
import type { GameEventMessage, MatchResultMessage } from './net.ts';
import type { DuelEvent, DuelSim } from './simulation.ts';

/** Flattens a simulation event into the numbered wire event. */
export function toGameEventMessage(event: DuelEvent, eventId: number): GameEventMessage {
  const { type, tick, ...rest } = event;
  const data: Record<string, number | string | boolean> = {};
  let actorId: string | undefined;
  let targetId: string | undefined;
  for (const [key, value] of Object.entries(rest)) {
    if (key === 'actorId') actorId = String(value);
    else if (key === 'targetId') targetId = String(value);
    else if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean')
      data[key] = value;
  }
  return { eventId, tick, type, actorId, targetId, data };
}

/** The result summary of a finished match. */
export function buildMatchResult(sim: DuelSim, elapsedMs: number): MatchResultMessage {
  return {
    winnerId: sim.winnerId,
    reason: sim.resultReason,
    elapsedMs,
    tick: sim.tick,
    players: sim.players.map((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      slot: p.slot,
      hpLeft: Math.round(p.hp),
      damageDealt: p.stats.damageDealt,
      damageTaken: p.stats.damageTaken,
      casts: { ...p.stats.casts },
      dodgesUsed: p.stats.dodgesUsed,
      dodgesSuccessful: p.stats.dodgesSuccessful,
      shieldAbsorbed: p.stats.shieldAbsorbed,
    })),
  };
}
