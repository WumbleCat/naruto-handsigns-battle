import { createContext, useContext } from 'react';

export type ToastTone = 'info' | 'ok' | 'danger';

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss. */
  durationMs?: number;
}

export interface ToastApi {
  show: (options: ToastOptions) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}
