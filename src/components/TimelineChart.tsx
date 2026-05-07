import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useTheme } from '../contexts/useTheme';
import { ForecastPoint, forecastTicketsByDate } from '../services/analytics';
import { useMemo } from 'react';

interface TimelineChartProps {
  data: { date: string; count: number }[];
  onSelectDate?: (date: string) => void;
  showForecast?: boolean;
}

interface ChartDatum extends ForecastPoint {
  displayDate: string;
}

export default function TimelineChart({
  data,
  onSelectDate,
  showForecast = true,
}: TimelineChartProps) {
  const { isDark } = useTheme();

  const series: ChartDatum[] = useMemo(() => {
    const base = showForecast ? forecastTicketsByDate(data, 7) : data.map(d => ({
      date: d.date,
      count: d.count,
      forecast: null as number | null,
    }));
    return base.map(d => ({
      ...d,
      displayDate: new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }),
    }));
  }, [data, showForecast]);

  const total = data.reduce((sum, item) => sum + item.count, 0);
  const average = data.length > 0 ? Math.round((total / data.length) * 10) / 10 : 0;
  const max = Math.max(...data.map(d => d.count), 0);

  const projectedNextWeek = series
    .filter(d => d.forecast !== null)
    .reduce((s, d) => s + (d.forecast ?? 0), 0);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-minerva p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
            <TrendingUp className="w-5 h-5 text-emerald-600" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold text-minerva-navy dark:text-white">
            Evolução de Chamados
          </h2>
        </div>
        <div className="flex items-center justify-center h-[200px] text-gray-400 dark:text-gray-500">
          Nenhum dado disponível para o período
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-minerva p-6 card-hover">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
            <TrendingUp className="w-5 h-5 text-emerald-600" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-minerva-navy dark:text-white">
              Evolução de Chamados
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {showForecast ? 'Histórico + projeção 7 dias' : 'Chamados abertos por dia'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 flex-wrap">
          <div className="text-right">
            <p className="text-2xl font-bold text-minerva-navy dark:text-white">{total}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">total no período</p>
          </div>
          <div className="h-10 w-px bg-gray-200 dark:bg-slate-600" aria-hidden />
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-600">{average}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">média/dia</p>
          </div>
          <div className="h-10 w-px bg-gray-200 dark:bg-slate-600" aria-hidden />
          <div className="text-right">
            <p className="text-2xl font-bold text-minerva-red">{max}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">pico máximo</p>
          </div>
          {showForecast && projectedNextWeek > 0 && (
            <>
              <div className="h-10 w-px bg-gray-200 dark:bg-slate-600" aria-hidden />
              <div className="text-right">
                <p className="text-2xl font-bold text-violet-500">≈{projectedNextWeek}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">próx. 7 dias</p>
              </div>
            </>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={series} margin={{ left: -10, right: 10 }}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isDark ? '#60a5fa' : '#1D2E40'} stopOpacity={0.3} />
              <stop offset="95%" stopColor={isDark ? '#60a5fa' : '#1D2E40'} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={isDark ? '#475569' : '#e2e8f0'}
            vertical={false}
          />
          <XAxis
            dataKey="displayDate"
            tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
            axisLine={{ stroke: isDark ? '#475569' : '#e2e8f0' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const datum = payload[0].payload as ChartDatum;
                const isForecast = datum.count === null && datum.forecast !== null;
                return (
                  <div
                    style={{
                      backgroundColor: isDark ? '#1e293b' : '#fff',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
                      boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.3)',
                    }}
                  >
                    <p
                      style={{
                        color: isDark ? '#94a3b8' : '#64748b',
                        fontSize: '12px',
                        marginBottom: '4px',
                      }}
                    >
                      {isForecast ? 'Projeção: ' : 'Data: '}
                      {datum.displayDate}
                    </p>
                    <p
                      style={{
                        color: isForecast ? '#a78bfa' : isDark ? '#f1f5f9' : '#1D2E40',
                        fontSize: '16px',
                        fontWeight: 700,
                      }}
                    >
                      {isForecast ? `≈${datum.forecast}` : datum.count} chamados
                    </p>
                  </div>
                );
              }
              return null;
            }}
            cursor={{ stroke: '#F84454', strokeWidth: 2, strokeDasharray: '5 5' }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={isDark ? '#60a5fa' : '#1D2E40'}
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorCount)"
            dot={{ r: 4, fill: isDark ? '#60a5fa' : '#1D2E40', strokeWidth: 2, stroke: isDark ? '#1e293b' : '#fff' }}
            activeDot={{
              r: 6,
              fill: '#F84454',
              strokeWidth: 2,
              stroke: isDark ? '#1e293b' : '#fff',
              cursor: onSelectDate ? 'pointer' : undefined,
              onClick: onSelectDate
                ? (_evt: unknown, payload: { payload?: ChartDatum }) => {
                    if (payload?.payload?.date) onSelectDate(payload.payload.date);
                  }
                : undefined,
            }}
          />
          {showForecast && (
            <Area
              type="monotone"
              dataKey="forecast"
              stroke="#a78bfa"
              strokeWidth={2}
              strokeDasharray="6 4"
              fill="url(#colorForecast)"
              dot={false}
              activeDot={{ r: 5, fill: '#a78bfa' }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      {onSelectDate && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Dica: clique em um ponto para filtrar o dashboard pela data.
        </p>
      )}
    </div>
  );
}
