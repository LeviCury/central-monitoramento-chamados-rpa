/**
 * Donut compacto Incidente vs Requisição.
 * Clicar em uma fatia (ou no chip da legenda) aplica/remove o filtro `types`.
 */
import { Cell, Pie, PieChart as RPieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Tag } from 'lucide-react';
import { useTheme } from '../contexts/useTheme';
import type { TicketType } from '../types';
import type { TypeAggregate } from '../services/analytics';
import {
  ChartCard,
  GlassTooltip,
  fillForType,
} from './charts/chartTheme';

interface TypeChartProps {
  data: TypeAggregate[];
  onSelectType?: (type: TicketType) => void;
  selectedTypes?: TicketType[];
}

export default function TypeChart({ data, onSelectType, selectedTypes }: TypeChartProps) {
  const { isDark } = useTheme();
  const selectedSet = new Set(selectedTypes ?? []);

  const total = data.reduce((sum, item) => sum + item.count, 0);
  const chartData = data.map(item => ({
    ...item,
    color: fillForType(item.type),
    percent: total > 0 ? (item.count / total) * 100 : 0,
  }));

  const empty = total === 0;

  return (
    <ChartCard
      icon={<Tag className="w-4 h-4" />}
      title="Distribuição por Tipo"
      subtitle={`Incidente x Requisição · ${total} chamado${total === 1 ? '' : 's'}`}
    >
      {empty ? (
        <div className="flex items-center justify-center h-[220px] text-minerva-navy/40 dark:text-white/40 text-sm">
          Nenhum dado disponível
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 items-center">
          <div className="relative h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <RPieChart>
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={3}
                  animationDuration={800}
                  cursor={onSelectType ? 'pointer' : 'default'}
                  onClick={payload => {
                    const type = (payload as { type?: TicketType }).type;
                    if (type && onSelectType) onSelectType(type);
                  }}
                >
                  {chartData.map(entry => {
                    const isSelected = selectedSet.has(entry.type);
                    const isDimmed = selectedSet.size > 0 && !isSelected;
                    return (
                      <Cell
                        key={entry.type}
                        fill={entry.color}
                        fillOpacity={isDimmed ? 0.3 : 0.95}
                        stroke={isSelected ? '#F84454' : isDark ? '#0E1822' : '#ffffff'}
                        strokeWidth={isSelected ? 3 : 2}
                      />
                    );
                  })}
                </Pie>
                <Tooltip
                  content={
                    <GlassTooltip
                      renderItem={item => {
                        const payload = item.payload as
                          | { percent?: number; label?: string }
                          | undefined;
                        const pct = payload?.percent ?? 0;
                        return (
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{
                                backgroundColor: item.color,
                                boxShadow: `0 0 8px ${item.color}66`,
                              }}
                              aria-hidden
                            />
                            <span className="text-minerva-navy/70 dark:text-white/70 mr-auto">
                              {payload?.label}
                            </span>
                            <span className="font-bold tabular-nums text-minerva-navy dark:text-white">
                              {item.value} ({pct.toFixed(1)}%)
                            </span>
                          </div>
                        );
                      }}
                    />
                  }
                />
              </RPieChart>
            </ResponsiveContainer>
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
              aria-hidden
            >
              <span className="text-3xl font-bold gradient-text tabular-nums">{total}</span>
              <span className="text-[11px] text-minerva-navy/55 dark:text-white/55">total</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {chartData.map(item => {
              const isSelected = selectedSet.has(item.type);
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => onSelectType?.(item.type)}
                  disabled={!onSelectType}
                  aria-pressed={isSelected}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl transition-all border text-left ${
                    isSelected
                      ? 'bg-minerva-navy text-white border-minerva-navy shadow-minerva-sm'
                      : 'border-minerva-navy/8 dark:border-white/10 bg-white/40 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/10 text-minerva-navy dark:text-white'
                  } ${!onSelectType ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: item.color,
                        boxShadow: isSelected ? 'none' : `0 0 6px ${item.color}55`,
                      }}
                      aria-hidden
                    />
                    <span className="truncate text-sm font-medium">{item.label}</span>
                  </span>
                  <span className="flex items-baseline gap-1 shrink-0">
                    <span className="font-semibold tabular-nums">{item.count}</span>
                    <span
                      className={`text-[10px] tabular-nums ${
                        isSelected ? 'text-white/70' : 'text-minerva-navy/55 dark:text-white/55'
                      }`}
                    >
                      {item.percent.toFixed(1)}%
                    </span>
                  </span>
                </button>
              );
            })}
            {onSelectType && (
              <p className="text-[11px] text-minerva-navy/45 dark:text-white/45 mt-1">
                Clique em um tipo para filtrar.
              </p>
            )}
          </div>
        </div>
      )}
    </ChartCard>
  );
}
