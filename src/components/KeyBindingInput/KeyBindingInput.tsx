import { useEffect, useState, type KeyboardEvent } from 'react';
import { keyLabel } from '../../features/battle/keyLabel';
import styles from './KeyBindingInput.module.css';

export interface KeyBindingInputProps {
  /** Accessible name, e.g. "Key for Tiger". */
  label: string;
  /** Current KeyboardEvent.code. */
  code: string;
  onChange: (code: string) => void;
  /** Name of the sign already using the candidate key; shown as a refusal. */
  conflictWith?: string | null;
  disabled?: boolean;
}

const IGNORED_CODES = new Set([
  'Escape',
  'Tab',
  'Enter',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'CapsLock',
]);

/** Shows the bound key; click (or press) to capture the next key pressed. */
export function KeyBindingInput({
  label,
  code,
  onChange,
  conflictWith = null,
  disabled = false,
}: KeyBindingInputProps) {
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!listening) return;
    const timer = window.setTimeout(() => setListening(false), 8000);
    return () => window.clearTimeout(timer);
  }, [listening]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!listening) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setListening(true);
      }
      return;
    }
    event.preventDefault();
    if (event.code === 'Escape') {
      setListening(false);
      return;
    }
    if (IGNORED_CODES.has(event.code)) return;
    setListening(false);
    onChange(event.code);
  };

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.input}
        data-listening={listening || undefined}
        data-conflict={conflictWith ? true : undefined}
        aria-label={listening ? `${label}: press a key` : `${label}: ${keyLabel(code)}`}
        onClick={() => setListening(true)}
        onKeyDown={onKeyDown}
        onBlur={() => setListening(false)}
        disabled={disabled}
      >
        {listening ? (
          <span className={styles.prompt}>Press a key</span>
        ) : (
          <kbd className={styles.cap}>{keyLabel(code)}</kbd>
        )}
      </button>
      {conflictWith ? (
        <span className={styles.conflict} role="alert">
          Already used by {conflictWith}.
        </span>
      ) : null}
    </div>
  );
}
