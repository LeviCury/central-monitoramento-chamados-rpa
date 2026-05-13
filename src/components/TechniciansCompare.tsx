/**
 * Comparador de técnicos lado a lado.
 * O usuário escolhe até 4 técnicos e vê KPIs em colunas paralelas
 * com mini-bars proporcionais (quem tem o melhor valor aparece com
 * a barra cheia, os outros proporcionais).
 */
import { useMemo, useState } from 'react';
import { Ticket } from '../types';
import { getTechnicianMetrics, TechnicianMetrics } from '../services/analytics';
import { formatHoursMinutes } from '../utils/timeFormat';
import { ChevronDown, ChevronUp, Plus, Users, X } from 'lucide-react';

interface TechniciansCompareProps {
  tickets: Ticket[];
  technicians: string[];
}

const MAX = 4;

const COL_BAR = [
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-sky-500',
];

const AVATAR_GRADIENTS = [
  'from-rose-400 to-rose-600',
  'from-amber-400 to-amber-600',
  'from-emerald-400 to-emerald-600',
  'from-sky-400 to-sky-600',
  'from-violet-400 to-violet-600',
  'from-fuchsia-400 to-fuchsia-600',
  'from-teal-400 to-teal-600',
  'from-orange-400 to-orange-600',
];

function avatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function initials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
}

interface MetricRowProps {
  label: string;
  values: number[];
  highlight: 'high' | 'low';
  format: (v: number) => string;
}

function MetricRow({ label, values, highlight, format }: MetricRowProps) {
  const max = Math.max(...values, 0);
  const min = Math.min(...values);
  const sameValues = max === min;
  // Para a barra, o "ideal" é 100% no melhor; para os outros é
  // proporcional ao máximo (visual de comparação de magnitude).
  const denominator = max === 0 ? 1 : max;

  return (
    <tr className="border-t border-[var(--border-subtle)]">
      <th
        scope="row"
        className="text-left px-4 py-3 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider-2 align-middle"
      >
        {label}
      </th>
      {values.map((v, i) => {
        const isBest =
          values.length > 1 && (highlight === 'high' ? v === max : v === min) && !sameValues;
        const widthPct =
          highlight === 'high'
            ? (v / denominator) * 100
            : v === 0
              ? 0
              : (min / Math.max(v, 0.0001)) * 100;
        return (
          <td key={i} className="px-3 py-3 align-middle">
            <div className="flex flex-col items-stretch gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-sm font-semibold tnum ${
                    isBest
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-[var(--text-primary)]'
                  }`}
                >
                  {format(v)}
                </span>
                {isBest && (
                  <span className="text-[9px] uppercase tracking-wider-2 font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {highlight === 'high' ? 'top' : 'menor'}
                  </span>
                )}
              </div>
              <div className="h-1 bg-[var(--bg-subtle)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    isBest ? 'bg-emerald-500' : COL_BAR[i % COL_BAR.length]
                  } transition-[width] duration-700 ease-out`}
                  style={{ width: `${Math.max(0, Math.min(100, widthPct))}%` }}
                />
              </div>
            </div>
          </td>
        );
      })}
    </tr>
  );
}

export function TechniciansCompare({ tickets, technicians }: TechniciansCompareProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);

  const available = useMemo(
    () => technicians.filter(t => !selected.includes(t) && t),
    [technicians, selected]
  );

  const metrics: TechnicianMetrics[] = useMemo(
    () => selected.map(t => getTechnicianMetrics(tickets, t)),
    [tickets, selected]
  );

  const handleAdd = (tech: string) => {
    setSelected(prev => (prev.length >= MAX ? prev : [...prev, tech]));
  };

  const handleRemove = (tech: string) => {
    setSelected(prev => prev.filter(t => t !== tech));
  };

  return (
    <section className="surface-elevated rounded-3xl overflow-hidden">
      <header className="px-7 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <Users className="w-4 h-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)] tracking-[-0.01em]">
              Comparar Técnicos
            </h2>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Selecione até {MAX} técnicos lado a lado
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir comparador' : 'Recolher comparador'}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </header>

      {!collapsed && (
        <div className="px-7 pb-7 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {selected.map(tech => (
              <span
                key={tech}
                className="inline-flex items-center gap-2 pl-1 pr-2 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-primary)] text-sm animate-fade-in-up"
              >
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-semibold text-white bg-gradient-to-br ${avatarGradient(tech)}`}
                  aria-hidden
                >
                  {initials(tech)}
                </span>
                <span className="font-medium truncate max-w-[180px]">{tech}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(tech)}
                  aria-label={`Remover ${tech}`}
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[var(--text-tertiary)] hover:bg-rose-500/15 hover:text-rose-600 transition-colors"
                >
                  <X className="w-3 h-3" aria-hidden />
                </button>
              </span>
            ))}
            {selected.length < MAX && available.length > 0 && (
              <label className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-subtle)] border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] text-sm cursor-pointer hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors">
                <Plus className="w-3.5 h-3.5" aria-hidden />
                <span>Adicionar técnico</span>
                <select
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  value=""
                  onChange={e => {
                    if (e.target.value) handleAdd(e.target.value);
                  }}
                  aria-label="Selecionar técnico para comparar"
                >
                  <option value="">Adicionar técnico…</option>
                  {available.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {metrics.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-dashed border-[var(--border-default)]">
              <Users
                className="w-8 h-8 mx-auto text-[var(--text-tertiary)] opacity-50 mb-2"
                aria-hidden
              />
              <p className="text-sm text-[var(--text-tertiary)]">
                Adicione técnicos para começar a comparar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-7 px-7 pb-1">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider-2 text-[var(--text-tertiary)]">
                      Métrica
                    </th>
                    {metrics.map(m => (
                      <th
                        key={m.technician}
                        className="px-3 py-3 text-center"
                      >
                        <div className="flex items-center gap-2 justify-center">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-semibold text-white bg-gradient-to-br ${avatarGradient(m.technician)}`}
                            aria-hidden
                          >
                            {initials(m.technician)}
                          </span>
                          <span className="text-sm font-semibold text-[var(--text-primary)] truncate max-w-[140px]">
                            {m.technician}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <MetricRow
                    label="Chamados no período"
                    values={metrics.map(m => m.total)}
                    highlight="high"
                    format={v => v.toLocaleString('pt-BR')}
                  />
                  <MetricRow
                    label="Em aberto"
                    values={metrics.map(m => m.open)}
                    highlight="low"
                    format={v => v.toLocaleString('pt-BR')}
                  />
                  <MetricRow
                    label="Finalizados"
                    values={metrics.map(m => m.finalized)}
                    highlight="high"
                    format={v => v.toLocaleString('pt-BR')}
                  />
                  <MetricRow
                    label="Taxa de resolução"
                    values={metrics.map(m => m.closureRate)}
                    highlight="high"
                    format={v => `${v}%`}
                  />
                  <MetricRow
                    label="Abertos há muito tempo"
                    values={metrics.map(m => m.staleCount)}
                    highlight="low"
                    format={v => v.toLocaleString('pt-BR')}
                  />
                  <MetricRow
                    label="Média de dias em aberto"
                    values={metrics.map(m => Number(m.avgDaysOpen.toFixed(1)))}
                    highlight="low"
                    format={v => `${v}d`}
                  />
                  <MetricRow
                    label="Horas realizadas"
                    values={metrics.map(m => m.totalRealizedHours)}
                    highlight="high"
                    format={v => formatHoursMinutes(v)}
                  />
                  <MetricRow
                    label="Média de horas / chamado"
                    values={metrics.map(m => m.avgWorkHours)}
                    highlight="low"
                    format={v => formatHoursMinutes(v)}
                  />
                </tbody>
              </table>
            </div>
          )}

          {metrics.length > 0 && (
            <p className="text-[11px] text-[var(--text-tertiary)] leading-snug">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 align-middle" />
              Destaque em verde: melhor valor (maior em produtividade, menor em itens negativos).
            </p>
          )}
        </div>
      )}
    </section>
  );
}
