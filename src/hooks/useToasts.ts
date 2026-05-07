/**
 * Mini sistema de toasts global, sem dependências externas.
 * Os componentes consomem `useToasts()` para renderizar e `pushToast()`
 * para enfileirar mensagens.
 */
import { useEffect, useState } from 'react';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  durationMs: number;
}

type Listener = (toasts: Toast[]) => void;

const listeners = new Set<Listener>();
let queue: Toast[] = [];

function emit() {
  for (const listener of listeners) listener(queue);
}

export function pushToast(message: string, kind: ToastKind = 'info', durationMs = 3500) {
  const toast: Toast = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    message,
    durationMs,
  };
  queue = [...queue, toast];
  emit();
  setTimeout(() => dismissToast(toast.id), durationMs);
}

export function dismissToast(id: string) {
  queue = queue.filter(t => t.id !== id);
  emit();
}

export function useToasts(): Toast[] {
  const [list, setList] = useState<Toast[]>(queue);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return list;
}
