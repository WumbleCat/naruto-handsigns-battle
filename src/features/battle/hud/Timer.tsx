import { formatClock } from './formatClock';

export interface TimerProps {
  remainingMs: number;
  /** Turn to the danger colour under this many seconds. */
  warnUnderSeconds?: number;
}

export function Timer({ remainingMs, warnUnderSeconds = 10 }: TimerProps) {
  const danger = remainingMs <= warnUnderSeconds * 1000;
  return (
    <span
      className="t-hud-md"
      style={{
        display: 'inline-block',
        minWidth: '4ch',
        textAlign: 'center',
        color: danger ? 'var(--danger)' : 'var(--text)',
      }}
      role="timer"
      aria-label="Time left"
    >
      {formatClock(remainingMs)}
    </span>
  );
}
