/**
 * Bloco "🎯 Hoje" no topo do dashboard.
 * - Insights: leitura textual e curta dos KPIs (gerados por regras simples).
 * - Action Items: o que o time precisa **fazer**, com 1 clique para aplicar o filtro correspondente.
 */
import { ActionItem, Insight } from '../services/analytics';
import { ArrowRight, ChevronDown, ChevronUp, Sparkles, Target } from 'lucide-react';
import { useState } from 'react';

interface InsightsBlockProps {
  insights: Insight[];
  actionItems: ActionItem[];
  onApplyAction: (item: ActionItem) => void;
}

const INSIGHT_TONE: Record<Insight['tone'], string> = {
  good: 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  warn: 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200',
  bad: 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-200',
  neutral: 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/30 text-slate-700 dark:text-slate-200',
};

const SEVERITY_BADGE: Record<ActionItem['severity'], string> = {
  high: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30',
  medium: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  low: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
};

const SEVERITY_LABEL: Record<ActionItem['severity'], string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export function InsightsBlock({ insights, actionItems, onApplyAction }: InsightsBlockProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (insights.length === 0 && actionItems.length === 0) return null;

  return (
    <section
      data-export="insights"
      className="mb-6 rounded-2xl border border-minerva-navy/10 dark:border-white/10 bg-white dark:bg-slate-800 shadow-minerva overflow-hidden animate-fade-in"
      aria-label="Resumo do dia: insights e próximas ações"
    >
      <header className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-minerva-navy/5 to-minerva-navy/0 dark:from-white/5">
        <div className="flex items-center gap-2 text-minerva-navy dark:text-white">
          <Target className="w-5 h-5" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-wide">Hoje no RPA</h2>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir resumo' : 'Recolher resumo'}
          className="text-minerva-navy/60 dark:text-white/60 hover:text-minerva-navy dark:hover:text-white transition-colors"
        >
          {collapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </header>

      {!collapsed && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-minerva-navy/10 dark:bg-white/10">
          {insights.length > 0 && (
            <div className="p-5 bg-white dark:bg-slate-800">
              <div className="flex items-center gap-2 mb-3 text-minerva-navy dark:text-white">
                <Sparkles className="w-4 h-4" aria-hidden />
                <h3 className="text-xs font-semibold uppercase tracking-wide">Leitura rápida</h3>
              </div>
              <ul className="space-y-2">
                {insights.map(i => (
                  <li
                    key={i.id}
                    className={`text-sm rounded-xl border px-3 py-2 flex gap-2 items-start ${INSIGHT_TONE[i.tone]}`}
                  >
                    <span aria-hidden className="text-base leading-none">{i.emoji}</span>
                    <span className="leading-snug">{i.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {actionItems.length > 0 && (
            <div className="p-5 bg-white dark:bg-slate-800">
              <div className="flex items-center gap-2 mb-3 text-minerva-navy dark:text-white">
                <ArrowRight className="w-4 h-4" aria-hidden />
                <h3 className="text-xs font-semibold uppercase tracking-wide">Próximas ações</h3>
              </div>
              <ul className="space-y-2">
                {actionItems.map(a => (
                  <li
                    key={a.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 hover:border-minerva-red/40 dark:hover:border-minerva-red/40 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => onApplyAction(a)}
                      disabled={!a.filter}
                      className="w-full text-left px-3 py-2 flex items-start gap-3 disabled:cursor-default group"
                    >
                      <span
                        className={`shrink-0 inline-flex items-center justify-center min-w-[2.25rem] h-9 px-2 rounded-lg border text-sm font-bold ${SEVERITY_BADGE[a.severity]}`}
                        aria-label={`Severidade ${SEVERITY_LABEL[a.severity]}`}
                      >
                        {a.count}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-minerva-navy dark:text-white truncate">
                          {a.title}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400 leading-snug">
                          {a.description}
                        </span>
                      </span>
                      {a.filter && (
                        <span
                          className="shrink-0 self-center text-xs font-medium text-minerva-navy/70 dark:text-white/70 group-hover:text-minerva-red transition-colors"
                          aria-hidden
                        >
                          Filtrar →
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
