import { useParams } from 'react-router';
import { ComingSoon } from './ComingSoon';

export function PracticeJutsuPage() {
  const { jutsuId } = useParams();
  return (
    <ComingSoon
      title="Practice"
      milestone="v0.5.0"
      summary={`Live per-sign feedback for ${jutsuId ?? 'this jutsu'}, with completion time, attempts and your best.`}
      backTo="/practice"
      backLabel="Back to practice"
    />
  );
}
