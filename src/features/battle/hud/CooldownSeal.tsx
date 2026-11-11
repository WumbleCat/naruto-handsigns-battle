import { useEffect, useRef, useState } from 'react';
import { Seal } from '../../../components/Seal/Seal';
import { CONTENT } from '../../../content/content.config';
import styles from './Overlay.module.css';

export interface CooldownSealProps {
  /** Engine time when Substitution is ready; 0 when ready now. */
  readyAt: number;
  now: number;
  cooldownMs: number;
}

/** The Substitution seal in the centre column: a ring fills while cooling, pulses when ready. */
export function CooldownSeal({ readyAt, now, cooldownMs }: CooldownSealProps) {
  const cooling = readyAt > now;
  const progress = cooling ? 1 - Math.max(0, Math.min(1, (readyAt - now) / cooldownMs)) : 1;
  const wasCooling = useRef(cooling);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (wasCooling.current && !cooling) {
      setPulse(true);
      const timer = window.setTimeout(() => setPulse(false), 300);
      wasCooling.current = cooling;
      return () => window.clearTimeout(timer);
    }
    wasCooling.current = cooling;
    return undefined;
  }, [cooling]);

  const seconds = Math.ceil(Math.max(0, readyAt - now) / 1000);
  const label = cooling
    ? `${CONTENT.elements.substitution.name} ready in ${seconds} s`
    : `${CONTENT.elements.substitution.name} ready`;

  return (
    <div className={styles.cooldown} data-cooling={cooling || undefined}>
      <Seal
        element="substitution"
        size={48}
        variant={cooling ? 'ring' : 'outline'}
        progress={progress}
        pulse={pulse}
        label={label}
      />
      <span className="t-small t-muted">{cooling ? `${seconds} s` : 'Ready'}</span>
    </div>
  );
}
