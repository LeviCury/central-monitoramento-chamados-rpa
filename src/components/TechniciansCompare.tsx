/**
 * Comparador de técnicos lado a lado.
 * O usuário escolhe até 4 técnicos e vê KPIs em colunas paralelas.
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

const HEADER_COLOR_CYCLE = [
  'from-minerva-navy to-minerva-navy-light',
  'from-emerald-500 to-emerald-600',
  'from-amber-400 to-amber-500',
  'from-violet-500 to-violet-600',
];

function MetricRow({
  label,
  values,
  highlight,
  format,
}: {
  label: string;
  values: number[];
  highlight: 'high' | 'low';
  format: (v: number) => string;
}) {
  const max = Math.max(...values);
  const min = Math.min(...values);

  return (
    <tr className="border-t border-minerva-navy/10 dark:border-white/10">
      <th
        scope="row"
        className="text-left px-4 py-3 text-xs font-semibold text-minerva-navy/70 dark:text-white/70 uppercase tracking-wide"
      >
        {label}
      </th>
      {values.map((v, i) => {
        const isBest =
          values.length > 1 && (highlight === 'high' ? v === max : v === min) && max !== min;
        return (
          <td
            key={i}
            className={`px-4 py-3 text-center text-sm font-bold ${
              isBest ? 'text-emerald-600 dark:text-emerald-300' : 'text-minerva-navy dark:text-white'
            }`}
          >
            {format(v)}
            {isBest && (
              <span className="ml-1 text-[10px] uppercase tracking-wider opacity-70">
                {highlight === 'high' ? 'top' : 'menor'}
              </span>
            )}
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
    <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-minerva overflow-hidden">
      <header className="px-5 py-4 bg-gradient-to-r from-minerva-navy to-minerva-navy-light flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-xl">
            <Users className="w-5 h-5 text-white" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Comparar Técnicos</h2>
            <p className="text-white/60 text-xs">
              Selecione até {MAX} técnicos para ver KPIs lado a lado
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir comparador' : 'Recolher comparador'}
          className="text-white/70 hover:text-white"
        >
          {collapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </header>

      {!collapsed && (
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {selected.map(tech => (
              <span
                key={tech}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-minerva-navy/10 dark:bg-white/10 text-minerva-navy dark:text-white text-sm"
              >
                {tech}
                <button
                  type="button"
                  onClick={() => handleRemove(tech)}
                  aria-label={`Remover ${tech}`}
                  className="hover:text-minerva-red"
                >
                  <X className="w-3.5 h-3.5" aria-hidden />
                </button>
              </span>
            ))}
            {selected.length < MAX && available.length > 0 && (
              <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-minerva-navy/5 dark:bg-white/5 text-minerva-navy dark:text-white text-sm cursor-pointer hover:bg-minerva-navy/10 dark:hover:bg-white/10">
                <Plus className="w-3.5 h-3.5" aria-hidden />
                <span className="sr-only">Adicionar técnico</span>
                <select
                  className="bg-transparent text-sm focus:outline-none cursor-pointer"
                  value=""
                  onChange={e => {
                    if (e.target.value) handleAdd(e.target.value);
                  }}
                  aria-label="Selecionar técnico para comparar"
                >
                  <option value="">Adicionar técnico…</option>
                  {available.map(t => (
                    <option key={t} value={t} className="text-minerva-navy">
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {metrics.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
              Adicione técnicos para começar a comparar.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-minerva-navy/60 dark:text-white/60">
                      Métrica
                    </th>
                    {metrics.map((m, i) => (
                      <th
                        key={m.technician}
                        className={`px-4 py-3 text-center text-sm font-semibold text-white bg-gradient-to-br ${HEADER_COLOR_CYCLE[i % HEADER_COLOR_CYCLE.length]} ${i === 0 ? 'rounded-tl-xl' : ''} ${i === metrics.length - 1 ? 'rounded-tr-xl' : ''}`}
                      >
                        {m.technician}
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
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Destaque verde: melhor valor (maior em produtividade, menor em itens negativos como
              chamados antigos ou tempo médio).
            </p>
          )}
        </div>
      )}
    </section>
  );
}
