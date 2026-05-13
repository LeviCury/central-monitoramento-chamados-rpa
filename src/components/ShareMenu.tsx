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
import {
  ActionItem,
  Insight,
  MetricsDelta,
  TicketMetrics,
} from '../services/analytics';
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
  /** Comparativo com período anterior — para o PDF executivo mostrar deltas. */
  delta?: MetricsDelta;
  /** Distribuição por status para o mini-chart no PDF executivo. */
  statusBreakdown?: Array<{ status: string; count: number }>;
  /** Top técnicos para o ranking no PDF executivo. */
  technicianBreakdown?: Array<{ technician: string; count: number }>;
}

export function ShareMenu({
  getCaptureTarget,
  metrics,
  insights,
  actionItems,
  periodLabel,
  groupName,
  delta,
  statusBreakdown,
  technicianBreakdown,
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
          delta,
          statusBreakdown,
          technicianBreakdown,
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
        className="primary-btn inline-flex items-center gap-2 h-9 px-3.5 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
        title="Compartilhar / Exportar"
      >
        {anyBusy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
        ) : (
          <Share2 className="w-3.5 h-3.5" aria-hidden />
        )}
        Compartilhar
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-80 rounded-2xl bg-[var(--bg-elevated)] shadow-lifted ring-1 ring-[var(--border-subtle)] z-50 overflow-hidden animate-fade-in-up"
          style={{ animationDuration: '180ms' }}
        >
          <div className="px-4 pt-3.5 pb-2 border-b border-[var(--border-subtle)]">
            <p className="text-[10px] font-semibold uppercase tracking-wider-2 text-[var(--text-tertiary)]">
              Compartilhar painel
            </p>
            <p className="text-[12px] text-[var(--text-secondary)] mt-0.5 leading-snug">
              Escolha um formato. Tudo é gerado a partir dos dados atuais.
            </p>
          </div>
          <ul className="py-1.5">
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
                    className="w-full text-left px-3 py-2.5 mx-1.5 rounded-lg flex items-start gap-3 hover:bg-[var(--bg-subtle)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
                    style={{ width: 'calc(100% - 12px)' }}
                  >
                    <span className="shrink-0 mt-0.5 w-7 h-7 rounded-md bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                      {itemBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Icon className="w-3.5 h-3.5" aria-hidden strokeWidth={2.2} />
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-semibold text-[var(--text-primary)] tracking-[-0.005em]">
                        {it.label}
                      </span>
                      <span className="block text-[11.5px] text-[var(--text-tertiary)] mt-0.5 leading-snug">
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
