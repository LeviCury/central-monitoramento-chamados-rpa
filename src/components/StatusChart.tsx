import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PieChart } from 'lucide-react';
import { useTheme } from '../contexts/useTheme';
import {
  ChartCard,
  ChartGradients,
  GlassTooltip,
  fillForStatus,
  getAxisProps,
  getGridStroke,
  getCursorFill,
} from './charts/chartTheme';

interface StatusChartProps {
  data: { status: string; count: number }[];
  onSelectStatus?: (status: string) => void;
  selectedStatuses?: string[];
}

function formatStatus(status: string): string {
  if (!status) return 'Desconhecido';
  const abbreviations: Record<string, string> = {
    'Em Atendimento (atribuído)': 'Em Atend. (atrib.)',
    'Em Atendimento (planejado)': 'Em Atend. (plan.)',
  };
  return abbreviations[status] || status;
}

export default function StatusChart({ data, onSelectStatus, selectedStatuses }: StatusChartProps) {
  const { isDark } = useTheme();
  const selectedSet = new Set(selectedStatuses ?? []);

  const chartData = data.map(item => ({
    ...item,
    displayStatus: formatStatus(item.status),
    color: fillForStatus(item.status),
  }));

  const total = chartData.reduce((sum, item) => sum + item.count, 0);

  if (chartData.length === 0) {
    return (
      <ChartCard
        icon={<PieChart className="w-4 h-4" />}
        title="Distribuição por Status"
        subtitle="Sem dados"
      >
        <div className="flex items-center justify-center h-[260px] text-minerva-navy/40 dark:text-white/40 text-sm">
          Nenhum dado disponível
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      icon={<PieChart className="w-4 h-4" />}
      title="Distribuição por Status"
      subtitle={`${total} chamados no total`}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 8, bottom: 18, left: -8, right: 8 }}>
          <ChartGradients />
          <CartesianGrid strokeDasharray="3 3" stroke={getGridStroke(isDark)} vertical={false} />
          <XAxis
            dataKey="displayStatus"
            angle={-20}
            textAnchor="end"
            height={56}
            interval={0}
            {...getAxisProps(isDark)}
          />
          <YAxis allowDecimals={false} {...getAxisProps(isDark)} />
          <Tooltip
            content={
              <GlassTooltip
                renderItem={item => {
                  const payload = item.payload as { status?: string } | undefined;
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
                        {payload?.status}
                      </span>
                      <span className="font-bold tabular-nums text-minerva-navy dark:text-white">
                        {item.value}
                      </span>
                    </div>
                  );
                }}
              />
            }
            cursor={{ fill: getCursorFill(isDark) }}
          />
          <Bar
            dataKey="count"
            radius={[8, 8, 0, 0]}
            animationDuration={800}
            onClick={payload => {
              const status = (payload as { status?: string }).status;
              if (status && onSelectStatus) onSelectStatus(status);
            }}
            cursor={onSelectStatus ? 'pointer' : 'default'}
          >
            {chartData.map((entry, index) => {
              const isSelected = selectedSet.has(entry.status);
              const isDimmed = selectedSet.size > 0 && !isSelected;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  fillOpacity={isDimmed ? 0.30 : 0.92}
                  stroke={isSelected ? '#F84454' : 'none'}
                  strokeWidth={isSelected ? 2 : 0}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legenda clicável */}
      <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-minerva-navy/8 dark:border-white/8">
        {chartData.map((item, index) => {
          const isSelected = selectedSet.has(item.status);
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelectStatus?.(item.status)}
              disabled={!onSelectStatus}
              aria-pressed={isSelected}
              className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-full border transition-all ${
                isSelected
                  ? 'bg-minerva-navy text-white border-minerva-navy shadow-minerva-sm'
                  : 'bg-white/40 dark:bg-white/5 border-minerva-navy/8 dark:border-white/10 hover:bg-white/70 dark:hover:bg-white/10 text-minerva-navy/80 dark:text-white/80'
              } ${!onSelectStatus ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor: item.color,
                  boxShadow: isSelected ? 'none' : `0 0 6px ${item.color}55`,
                }}
                aria-hidden
              />
              <span>{item.status}</span>
              <span
                className={`font-semibold tabular-nums ${
                  isSelected ? 'text-white' : 'text-minerva-navy dark:text-white'
                }`}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </div>
      {onSelectStatus && (
        <p className="text-[11px] text-minerva-navy/45 dark:text-white/45 mt-3">
          Clique em um status para filtrar.
        </p>
      )}
    </ChartCard>
  );
}
