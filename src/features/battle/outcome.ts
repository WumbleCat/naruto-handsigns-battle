import type { BattleState } from '../../engine/events';
import { otherPlayer, type PlayerId } from '../../engine/types';
import type { BattleOutcome } from './battleSessionContext';

/** Summarises a finished engine state from the local player's point of view. */
export function buildOutcome(state: BattleState, localPlayer: PlayerId): BattleOutcome {
  if (!state.result) throw new Error('buildOutcome needs a finished match');
  const me = state.players[localPlayer];
  const them = state.players[otherPlayer(localPlayer)];
  const result =
    state.result.winner === null ? 'draw' : state.result.winner === localPlayer ? 'win' : 'loss';
  return {
    result,
    endReason: state.result.reason,
    durationSeconds: Math.max(0, Math.round((state.now - state.startedAt) / 1000)),
    playerHpLeft: me.hp,
    opponentHpLeft: them.hp,
    damageDealt: me.stats.damageDealt,
    damageTaken: me.stats.damageTaken,
    jutsusUsed: { ...me.stats.jutsusCast },
  };
}
