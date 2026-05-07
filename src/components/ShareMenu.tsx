/**
 * Menu "Compartilhar" — gera artefatos prontos para enviar:
 * - Resumo Executivo (PDF gerado dos dados, 1 página, sem screenshot)
 * - Snapshot do dashboard (PNG / PDF / Copiar imagem)
 *
 * Todas as libs pesadas (html2canvas, jspdf) entram via lazy import
 * ao clicar — nada vai pro bundle inicial.
 */
import { useEffect, useRef, useState } from 'react';
import { Camera, Copy, FileDown, FileText, Loader2, Share2 } from 'lucide-react';
import { ActionItem, Insight, TicketMetrics } from '../services/analytics';
import { pushToast } from '../hooks/useToasts';

type Action = 'pdf-summary' | 'png' | 'pdf-snapshot' | 'copy';

interface ShareMenuProps {
  /** O elemento da página que vira PNG/PDF (snapshot). */
  getCaptureTarget: () => HTMLElement | null;
  metrics: TicketMetrics;
  insights: Insight[];
  actionItems: ActionItem[];
  periodLabel: string;
  groupName?: string;
}

export function ShareMenu({
  getCaptureTarget,
  metrics,
  insights,
  actionItems,
  periodLabel,
  groupName,
}: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Action | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const runWithUx = async (action: Action, fn: () => Promise<void>, successMsg: string) => {
    setBusy(action);
    try {
      await fn();
      pushToast(successMsg, 'success');
    } catch (err) {
      console.error('[ShareMenu]', action, err);
      pushToast(
        err instanceof Error && err.message
          ? `Falha: ${err.message}`
          : 'Falha ao gerar artefato',
        'error'
      );
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };

  const handleSummaryPdf = () =>
    runWithUx(
      'pdf-summary',
      async () => {
        const { downloadExecutiveSummaryPdf } = await import('../services/snapshotExport');
        await downloadExecutiveSummaryPdf({
          metrics,
          insights,
          actionItems,
          periodLabel,
          groupName,
        });
      },
      'Resumo executivo gerado'
    );

  const handlePng = () => {
    const target = getCaptureTarget();
    if (!target) {
      pushToast('Nada para capturar', 'error');
      return;
    }
    runWithUx(
      'png',
      async () => {
        const { downloadDashboardPng } = await import('../services/snapshotExport');
        await downloadDashboardPng(target);
      },
      'PNG do dashboard salvo'
    );
  };

  const handlePdfSnapshot = () => {
    const target = getCaptureTarget();
    if (!target) {
      pushToast('Nada para capturar', 'error');
      return;
    }
    runWithUx(
      'pdf-snapshot',
      async () => {
        const { downloadDashboardPdf } = await import('../services/snapshotExport');
        await downloadDashboardPdf(target);
      },
      'PDF do dashboard salvo'
    );
  };

  const handleCopy = () => {
    const target = getCaptureTarget();
    if (!target) {
      pushToast('Nada para capturar', 'error');
      return;
    }
    runWithUx(
      'copy',
      async () => {
        const { copyDashboardPng } = await import('../services/snapshotExport');
        await copyDashboardPng(target);
      },
      'Imagem copiada — cole no Teams, e-mail, etc.'
    );
  };

  const items: Array<{
    id: Action;
    icon: typeof FileText;
    label: string;
    description: string;
    onClick: () => void;
  }> = [
    {
      id: 'pdf-summary',
      icon: FileText,
      label: 'Resumo Executivo (PDF)',
      description: '1 página: KPIs + leitura + ações',
      onClick: handleSummaryPdf,
    },
    {
      id: 'pdf-snapshot',
      icon: FileDown,
      label: 'Dashboard como PDF',
      description: 'Captura visual em A4 paisagem',
      onClick: handlePdfSnapshot,
    },
    {
      id: 'png',
      icon: Camera,
      label: 'Dashboard como PNG',
      description: 'Salva imagem em alta',
      onClick: handlePng,
    },
    {
      id: 'copy',
      icon: Copy,
      label: 'Copiar imagem',
      description: 'Para colar no Teams ou e-mail',
      onClick: handleCopy,
    },
  ];

  const anyBusy = busy !== null;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={anyBusy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Compartilhar dashboard"
        className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all disabled:opacity-50 hover:scale-105"
        title="Compartilhar / Exportar"
      >
        {anyBusy ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
        ) : (
          <Share2 className="w-4 h-4" aria-hidden />
        )}
        Compartilhar
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-800 shadow-minerva-lg border border-minerva-navy/10 dark:border-white/10 z-50 overflow-hidden"
        >
          <ul>
            {items.map(it => {
              const Icon = it.icon;
              const itemBusy = busy === it.id;
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={it.onClick}
                    disabled={anyBusy}
                    className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-minerva-navy/5 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-minerva-navy/10 dark:bg-white/10 flex items-center justify-center text-minerva-navy dark:text-white">
                      {itemBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                      ) : (
                        <Icon className="w-4 h-4" aria-hidden />
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-minerva-navy dark:text-white">
                        {it.label}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {it.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
