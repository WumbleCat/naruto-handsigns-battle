import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  BattleSessionContext,
  type BattleOutcome,
  type BattleSessionState,
  type BattleSetup,
} from './battleSessionContext';

/** In-memory state shared by /play, /play/battle and /play/results. Lost on refresh by design. */
export function BattleSessionProvider({ children }: { children: ReactNode }) {
  const [setup, setSetup] = useState<BattleSetup | null>(null);
  const [outcome, setOutcome] = useState<BattleOutcome | null>(null);

  const start = useCallback((next: BattleSetup) => {
    setSetup(next);
    setOutcome(null);
  }, []);

  const finish = useCallback((next: BattleOutcome) => {
    setOutcome(next);
  }, []);

  const clear = useCallback(() => {
    setSetup(null);
    setOutcome(null);
  }, []);

  const value = useMemo<BattleSessionState>(
    () => ({ setup, outcome, start, finish, clear }),
    [setup, outcome, start, finish, clear],
  );

  return <BattleSessionContext.Provider value={value}>{children}</BattleSessionContext.Provider>;
}
