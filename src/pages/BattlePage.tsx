import { Navigate } from 'react-router';
import { useBattleSession } from '../features/battle/battleSessionContext';
import { ComingSoon } from './ComingSoon';

export function BattlePage() {
  const { setup } = useBattleSession();
  if (!setup) return <Navigate to="/play" replace />;
  return (
    <ComingSoon
      title="Battle"
      milestone="v0.4.0"
      summary="Two video panels, HP bars, sign trails, the flight strip and the Substitution cooldown."
      backTo="/play"
      backLabel="Back to pre-battle"
    />
  );
}
