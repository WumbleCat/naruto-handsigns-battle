import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import styles from './Toast.module.css';
import { ToastContext, type ToastOptions, type ToastTone } from './toastContext';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  durationMs: number;
}

const DEFAULT_DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    counter.current += 1;
    const item: ToastItem = {
      id: counter.current,
      message: options.message,
      tone: options.tone ?? 'info',
      durationMs: options.durationMs ?? DEFAULT_DURATION_MS,
    };
    setItems((current) => [...current, item]);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} aria-live="polite" aria-relevant="additions">
        {items.map((item) => (
          <ToastView key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, item.durationMs);
    return () => window.clearTimeout(timer);
  }, [item.durationMs, onDismiss]);

  return (
    <div
      className={styles.toast}
      data-tone={item.tone}
      role={item.tone === 'danger' ? 'alert' : 'status'}
    >
      <span className={styles.message}>{item.message}</span>
      <button type="button" className={styles.close} onClick={onDismiss} aria-label="Dismiss">
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
