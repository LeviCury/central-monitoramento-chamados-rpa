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
import {
  ChartCard,
  ChartGradients,
  GRADIENT,
  CHART_PALETTE,
  getAxisProps,
  getGridStroke,
} from './charts/chartTheme';

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
    const base = showForecast
      ? forecastTicketsByDate(data, 7)
      : data.map(d => ({
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
      <ChartCard
        icon={<TrendingUp className="w-4 h-4" />}
        title="Evolução de Chamados"
        subtitle="Sem dados"
      >
        <div className="flex items-center justify-center h-[200px] text-minerva-navy/40 dark:text-white/40 text-sm">
          Nenhum dado disponível para o período
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      icon={<TrendingUp className="w-4 h-4" />}
      title="Evolução de Chamados"
      subtitle={showForecast ? 'Histórico + projeção 7 dias' : 'Chamados abertos por dia'}
      actions={
        <div className="flex items-center gap-4 text-right">
          <Stat label="total" value={total} tone="navy" />
          <Sep />
          <Stat label="média/dia" value={average} tone="emerald" />
          <Sep />
          <Stat label="pico" value={max} tone="red" />
          {showForecast && projectedNextWeek > 0 && (
            <>
              <Sep />
              <Stat label="próx. 7d" value={`≈${projectedNextWeek}`} tone="violet" />
            </>
          )}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={series} margin={{ left: -8, right: 8, top: 4 }}>
          <ChartGradients />
          <defs>
            <linearGradient id="forecast-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_PALETTE.violetLight} stopOpacity={0.30} />
              <stop offset="100%" stopColor={CHART_PALETTE.violetLight} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={getGridStroke(isDark)} vertical={false} />
          <XAxis dataKey="displayDate" {...getAxisProps(isDark)} />
          <YAxis allowDecimals={false} {...getAxisProps(isDark)} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const datum = payload[0].payload as ChartDatum;
              const isForecast = datum.count === null && datum.forecast !== null;
              return (
                <div className="glass-card-strong rounded-xl px-3.5 py-2.5 min-w-[160px]">
                  <p className="text-[11px] uppercase tracking-wider text-minerva-navy/55 dark:text-white/55 font-semibold mb-1.5">
                    {isForecast ? 'Projeção · ' : ''}
                    {datum.displayDate}
                  </p>
                  <p
                    className={`text-base font-bold tabular-nums ${
                      isForecast
                        ? 'text-violet-500 dark:text-violet-300'
                        : 'gradient-text'
                    }`}
                  >
                    {isForecast ? `≈${datum.forecast}` : datum.count} chamados
                  </p>
                </div>
              );
            }}
            cursor={{ stroke: CHART_PALETTE.red, strokeWidth: 1.5, strokeDasharray: '4 4' }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={isDark ? CHART_PALETTE.skyLight : CHART_PALETTE.navy}
            strokeWidth={2.5}
            fill={isDark ? GRADIENT.area('sky') : GRADIENT.area('navy')}
            animationDuration={900}
            dot={{
              r: 3,
              fill: isDark ? CHART_PALETTE.skyLight : CHART_PALETTE.navy,
              strokeWidth: 2,
              stroke: isDark ? '#0E1822' : '#fff',
            }}
            activeDot={{
              r: 6,
              fill: CHART_PALETTE.red,
              strokeWidth: 2,
              stroke: isDark ? '#0E1822' : '#fff',
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
              stroke={CHART_PALETTE.violetLight}
              strokeWidth={2}
              strokeDasharray="6 4"
              fill="url(#forecast-area)"
              animationDuration={900}
              dot={false}
              activeDot={{ r: 5, fill: CHART_PALETTE.violetLight }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      {onSelectDate && (
        <p className="text-[11px] text-minerva-navy/45 dark:text-white/45 mt-3">
          Clique em um ponto para filtrar pela data.
        </p>
      )}
    </ChartCard>
  );
}

function Sep() {
  return <span className="h-8 w-px bg-minerva-navy/10 dark:bg-white/10" aria-hidden />;
}

interface StatProps {
  label: string;
  value: number | string;
  tone: 'navy' | 'emerald' | 'red' | 'violet';
}

function Stat({ label, value, tone }: StatProps) {
  const toneClass =
    tone === 'navy'
      ? 'text-minerva-navy dark:text-white'
      : tone === 'emerald'
        ? 'text-emerald-600 dark:text-emerald-300'
        : tone === 'red'
          ? 'text-minerva-red dark:text-rose-300'
          : 'text-violet-500 dark:text-violet-300';
  return (
    <div className="text-right">
      <p className={`text-xl font-bold tabular-nums leading-none ${toneClass}`}>{value}</p>
      <p className="text-[10px] text-minerva-navy/55 dark:text-white/55 uppercase tracking-wider mt-0.5">
        {label}
      </p>
    </div>
  );
}
