/**
 * Bloco "Hoje no RPA" — apresentação Apple-style.
 * Insights e ações com contraste mínimo, ênfase via tipografia.
 */
import { ActionItem, Insight } from '../services/analytics';
import { ArrowRight, ChevronDown, ChevronUp, Sparkles, Target } from 'lucide-react';
import { useState } from 'react';

interface InsightsBlockProps {
  insights: Insight[];
  actionItems: ActionItem[];
  onApplyAction: (item: ActionItem) => void;
}

const TONE_DOT: Record<Insight['tone'], string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-rose-500',
  neutral: 'bg-[var(--text-tertiary)]',
};

const SEVERITY_TONE: Record<ActionItem['severity'], string> = {
  high: 'text-rose-700 dark:text-rose-400 bg-rose-500/10',
  medium: 'text-amber-700 dark:text-amber-400 bg-amber-500/10',
  low: 'text-sky-700 dark:text-sky-400 bg-sky-500/10',
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
      className="surface-elevated rounded-3xl overflow-hidden animate-fade-in-up"
      aria-label="Resumo do dia: insights e próximas ações"
    >
      <header className="flex items-center justify-between px-7 pt-6 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)] shrink-0">
            <Target className="w-4 h-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)] tracking-[-0.01em]">
              Hoje no RPA
            </h2>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Resumo executivo do período
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir resumo' : 'Recolher resumo'}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </header>

      {!collapsed && (
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-subtle)]">
          {insights.length > 0 && (
            <div className="px-7 py-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
                <h3 className="text-[10px] font-semibold uppercase tracking-wider-2 text-[var(--text-tertiary)]">
                  Leitura rápida
                </h3>
              </div>
              <ul className="space-y-2.5">
                {insights.map(i => (
                  <li
                    key={i.id}
                    className="text-sm text-[var(--text-primary)] flex gap-3 items-start leading-snug"
                  >
                    <span
                      className={`mt-1.5 inline-block w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[i.tone]}`}
                      aria-hidden
                    />
                    <span>{i.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {actionItems.length > 0 && (
            <div className="px-7 py-5">
              <div className="flex items-center gap-2 mb-4">
                <ArrowRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" aria-hidden />
                <h3 className="text-[10px] font-semibold uppercase tracking-wider-2 text-[var(--text-tertiary)]">
                  Próximas ações
                </h3>
              </div>
              <ul className="space-y-1.5">
                {actionItems.map(a => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => onApplyAction(a)}
                      disabled={!a.filter}
                      className="group w-full text-left px-3 py-2.5 -mx-3 rounded-xl flex items-start gap-3 hover:bg-[var(--bg-subtle)] transition-colors disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <span
                        className={`shrink-0 inline-flex items-center justify-center min-w-[2rem] h-7 px-2 rounded-md text-xs font-semibold tnum ${SEVERITY_TONE[a.severity]}`}
                        aria-label={`Severidade ${SEVERITY_LABEL[a.severity]}`}
                      >
                        {a.count}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-[var(--text-primary)] truncate">
                          {a.title}
                        </span>
                        <span className="block text-xs text-[var(--text-secondary)] leading-snug mt-0.5">
                          {a.description}
                        </span>
                      </span>
                      {a.filter && (
                        <ArrowRight
                          className="w-3.5 h-3.5 mt-1 shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-all group-hover:translate-x-0.5"
                          aria-hidden
                        />
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
