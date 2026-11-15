import { BALANCE } from '../../content/balance.config';

/** The sign hold time as shown in copy, so the words follow the balance config. */
export function holdLabel(): string {
  return `${BALANCE.signHoldMs} ms`;
}
