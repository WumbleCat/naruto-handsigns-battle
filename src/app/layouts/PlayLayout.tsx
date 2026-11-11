import { RequireAuth } from '../../features/auth/guards';
import { BattleSessionProvider } from '../../features/battle/BattleSessionProvider';

/** /play, /play/battle and /play/results share one in-memory battle session behind auth. */
export function PlayLayout() {
  return (
    <BattleSessionProvider>
      <RequireAuth />
    </BattleSessionProvider>
  );
}
