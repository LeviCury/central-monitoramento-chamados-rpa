/**
 * Donut compacto Incidente vs Requisição.
 * Clicar em uma fatia (ou no chip da legenda) aplica/remove o filtro `types`.
 */
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Tag } from 'lucide-react';
import { useTheme } from '../contexts/useTheme';
import type { TicketType } from '../types';
import type { TypeAggregate } from '../services/analytics';

interface TypeChartProps {
  data: TypeAggregate[];
  onSelectType?: (type: TicketType) => void;
  selectedTypes?: TicketType[];
}

const TYPE_COLORS_LIGHT: Record<TicketType, string> = {
  incident: '#F84454',
  request: '#3b82f6',
  unknown: '#94a3b8',
};

const TYPE_COLORS_DARK: Record<TicketType, string> = {
  incident: '#fb7185',
  request: '#60a5fa',
  unknown: '#cbd5e1',
};

export default function TypeChart({ data, onSelectType, selectedTypes }: TypeChartProps) {
  const { isDark } = useTheme();
  const colors = isDark ? TYPE_COLORS_DARK : TYPE_COLORS_LIGHT;
  const selectedSet = new Set(selectedTypes ?? []);

  const total = data.reduce((sum, item) => sum + item.count, 0);
  const chartData = data.map(item => ({
    ...item,
    color: colors[item.type],
    percent: total > 0 ? (item.count / total) * 100 : 0,
  }));

  const empty = total === 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-minerva p-6 card-hover">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-minerva-navy/10 dark:bg-white/10 rounded-xl">
            <Tag className="w-5 h-5 text-minerva-navy dark:text-white" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-minerva-navy dark:text-white">
              Distribuição por Tipo
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Incidente x Requisição · {total} chamado{total === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      {empty ? (
        <div className="flex items-center justify-center h-[240px] text-gray-400 dark:text-gray-500">
          Nenhum dado disponível
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-center">
          <div className="relative h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={2}
                  cursor={onSelectType ? 'pointer' : 'default'}
                  onClick={(payload) => {
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
                        fillOpacity={isDimmed ? 0.3 : 1}
                        stroke={isSelected ? '#F84454' : isDark ? '#1e293b' : '#ffffff'}
                        strokeWidth={isSelected ? 3 : 2}
                      />
                    );
                  })}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.3)',
                    padding: '12px 16px',
                  }}
                  formatter={(value, _name, props) => {
                    const numericValue = typeof value === 'number' ? value : Number(value) || 0;
                    const payload = props?.payload as { percent?: number; label?: string } | undefined;
                    const pct = payload?.percent ?? 0;
                    return [
                      <span
                        key="value"
                        style={{ color: isDark ? '#f1f5f9' : '#1D2E40', fontWeight: 600 }}
                      >
                        {numericValue} ({pct.toFixed(1)}%)
                      </span>,
                      <span key="label" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                        {payload?.label ?? ''}
                      </span>,
                    ];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
              aria-hidden
            >
              <span className="text-3xl font-bold text-minerva-navy dark:text-white tabular-nums">
                {total}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                total
              </span>
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
                      ? 'bg-minerva-navy text-white border-minerva-navy'
                      : 'border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-minerva-navy dark:text-white'
                  } ${!onSelectType ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                      aria-hidden
                    />
                    <span className="truncate text-sm font-medium">{item.label}</span>
                  </span>
                  <span className="flex items-baseline gap-1 shrink-0">
                    <span className="font-semibold tabular-nums">{item.count}</span>
                    <span
                      className={`text-[10px] ${
                        isSelected ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {item.percent.toFixed(1)}%
                    </span>
                  </span>
                </button>
              );
            })}
            {onSelectType && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Dica: clique em um tipo para filtrar.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
