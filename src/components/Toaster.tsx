import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Toast, dismissToast, useToasts } from '../hooks/useToasts';

interface KindStyle {
  icon: JSX.Element;
  glass: string;
  progress: string;
  iconBg: string;
}

const KIND_STYLES: Record<Toast['kind'], KindStyle> = {
  success: {
    icon: <CheckCircle2 className="w-4 h-4" aria-hidden />,
    glass: 'glass-strong',
    progress: 'bg-emerald-500',
    iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  },
  error: {
    icon: <AlertTriangle className="w-4 h-4" aria-hidden />,
    glass: 'glass-strong',
    progress: 'bg-rose-500',
    iconBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  },
  info: {
    icon: <Info className="w-4 h-4" aria-hidden />,
    glass: 'glass-strong',
    progress: 'bg-sky-500',
    iconBg: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  },
};

export function Toaster() {
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notificações"
      className="fixed bottom-6 right-6 z-[80] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none"
    >
      {toasts.map(toast => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

interface ToastCardProps {
  toast: Toast;
}

/**
 * Render individual de um toast com:
 * - slide-in da direita ao montar
 * - slide-out + fade ao dispensar (espera ~240ms antes de notificar)
 * - barra de progresso linear decrescente cuja duração é exatamente
 *   `toast.durationMs`, sincronizada com o setTimeout do `pushToast`.
 */
function ToastCard({ toast }: ToastCardProps) {
  const style = KIND_STYLES[toast.kind];
  const [leaving, setLeaving] = useState(false);

  const handleDismiss = () => {
    if (leaving) return;
    setLeaving(true);
    // Aguarda animação de saída (~240ms = duração do `slide-out-right`)
    setTimeout(() => dismissToast(toast.id), 240);
  };

  // Auto-dismiss visual sincronizado com o `pushToast`. A queue já remove
  // o toast no fim do `durationMs`; aqui apenas garantimos que o card
  // anime saída quando isso acontecer (caso não seja fechado manualmente).
  useEffect(() => {
    const handle = setTimeout(() => setLeaving(true), Math.max(0, toast.durationMs - 240));
    return () => clearTimeout(handle);
  }, [toast.durationMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'pointer-events-auto relative overflow-hidden rounded-2xl shadow-lifted',
        style.glass,
        leaving ? 'animate-slide-out-right' : 'animate-slide-in-right',
      ].join(' ')}
    >
      <div className="flex items-start gap-3 p-3.5">
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0 mt-0.5 ${style.iconBg}`}
        >
          {style.icon}
        </span>
        <p className="flex-1 text-[13px] leading-snug font-medium text-[var(--text-primary)] pt-1">
          {toast.message}
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Fechar notificação"
          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-all"
        >
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 origin-left">
        <div
          className={`h-full origin-left ${style.progress}`}
          style={{
            animation: `progress-linear ${toast.durationMs}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}
