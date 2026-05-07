import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { Toast, dismissToast, useToasts } from '../hooks/useToasts';

const KIND_STYLES: Record<Toast['kind'], { icon: JSX.Element; ring: string }> = {
  success: {
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-300" aria-hidden />,
    ring: 'border-emerald-400/40 bg-emerald-500/15',
  },
  error: {
    icon: <AlertTriangle className="w-5 h-5 text-minerva-red" aria-hidden />,
    ring: 'border-minerva-red/40 bg-minerva-red/15',
  },
  info: {
    icon: <Info className="w-5 h-5 text-blue-300" aria-hidden />,
    ring: 'border-blue-400/40 bg-blue-500/15',
  },
};

export function Toaster() {
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notificações"
      className="fixed bottom-6 right-6 z-[80] flex flex-col gap-3 w-full max-w-sm"
    >
      {toasts.map(toast => {
        const style = KIND_STYLES[toast.kind];
        return (
          <div
            key={toast.id}
            role="status"
            className={`flex items-start gap-3 p-4 rounded-2xl border ${style.ring} backdrop-blur-md text-white shadow-minerva-lg animate-fade-in`}
          >
            <div className="mt-0.5">{style.icon}</div>
            <p className="flex-1 text-sm leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Fechar notificação"
              className="text-white/60 hover:text-white"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
