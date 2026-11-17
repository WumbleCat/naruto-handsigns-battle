import { useEffect, useState } from 'react';
import type { DuelRoom } from '../net/duelClient';
import type { ConnectionStatus } from '../net/useDuelSession';
import styles from './hud.module.css';

const RTT_WARN_MS = 150;
const JITTER_WARN_MS = 60;

export interface NetworkBadgeProps {
  room: DuelRoom | null;
  status: ConnectionStatus;
}

/** Round-trip time and jitter from the SDK's room clock, sampled twice a second. */
export function NetworkBadge({ room, status }: NetworkBadgeProps) {
  const [sample, setSample] = useState({ rtt: 0, jitter: 0 });

  useEffect(() => {
    if (!room) return;
    const read = () => {
      const rtt = room.clock.smoothedRtt();
      const jitter = room.clock.jitter();
      setSample({
        rtt: Number.isFinite(rtt) ? Math.round(rtt) : 0,
        jitter: Number.isFinite(jitter) ? Math.round(jitter) : 0,
      });
    };
    read();
    const timer = window.setInterval(read, 500);
    return () => window.clearInterval(timer);
  }, [room]);

  const poor = sample.rtt > RTT_WARN_MS || sample.jitter > JITTER_WARN_MS;
  const text =
    status === 'reconnecting'
      ? 'Reconnecting'
      : status === 'connected'
        ? `ping ${sample.rtt} ms, jitter ${sample.jitter} ms`
        : status;
  return (
    <span
      className={styles.network}
      data-poor={poor || undefined}
      data-status={status}
      data-testid="network"
    >
      {text}
      {poor && status === 'connected' ? ' (weak connection)' : ''}
    </span>
  );
}
