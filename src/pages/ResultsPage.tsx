import { Navigate } from 'react-router';
import { useBattleSession } from '../features/battle/battleSessionContext';
import { ComingSoon } from './ComingSoon';

export function ResultsPage() {
  const { outcome } = useBattleSession();
  if (!outcome) return <Navigate to="/play" replace />;
  return (
    <ComingSoon
      title="Results"
      milestone="v0.4.0"
      summary="Win or loss, damage dealt, jutsu used, and a rematch."
      backTo="/play"
      backLabel="Back to pre-battle"
    />
  );
}
