import { createContext, useContext } from 'react';
import type { BotDifficulty } from '../../content/types';
import type { InputMode } from '../../lib/settings/schema';

/** What the player chose on the pre-battle screen. */
export interface BattleSetup {
  difficulty: BotDifficulty;
  inputMode: InputMode;
}

/** Filled in by the battle page when a match ends (shape completed in v0.4.0). */
export interface BattleOutcome {
  result: 'win' | 'loss' | 'draw';
  endReason: 'ko' | 'timeout' | 'forfeit';
  durationSeconds: number;
  playerHpLeft: number;
  opponentHpLeft: number;
  damageDealt: number;
  damageTaken: number;
  clashesWon: number;
  clashesLost: number;
  substitutions: number;
  jutsusUsed: Record<string, number>;
}

export interface BattleSessionState {
  setup: BattleSetup | null;
  outcome: BattleOutcome | null;
  start: (setup: BattleSetup) => void;
  finish: (outcome: BattleOutcome) => void;
  clear: () => void;
}

export const BattleSessionContext = createContext<BattleSessionState | null>(null);

export function useBattleSession(): BattleSessionState {
  const state = useContext(BattleSessionContext);
  if (!state) throw new Error('useBattleSession must be used inside <BattleSessionProvider>');
  return state;
}
