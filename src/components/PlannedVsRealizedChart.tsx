import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Clock } from 'lucide-react';
import { useTheme } from '../contexts/useTheme';
import { formatHoursMinutes } from '../utils/timeFormat';
import {
  ChartCard,
  ChartGradients,
  GRADIENT,
  GlassTooltip,
  CHART_PALETTE,
  getAxisProps,
  getGridStroke,
  getCursorFill,
} from './charts/chartTheme';

interface PlannedVsRealizedChartProps {
  data: { collaborator: string; planned: number; realized: number; legacy: number }[];
}

function truncateName(name: string, maxLength = 18): string {
  if (name.length <= maxLength) return name;
  return `${name.substring(0, maxLength)}…`;
}

export default function PlannedVsRealizedChart({ data }: PlannedVsRealizedChartProps) {
  const { isDark } = useTheme();
  const chartData = data.map(item => ({
    ...item,
    displayName: truncateName(item.collaborator),
  }));

  const totalPlanned = data.reduce((total, item) => total + item.planned, 0);
  const totalRealized = data.reduce((total, item) => total + item.realized, 0);

  if (chartData.length === 0) {
    return (
      <ChartCard
        icon={<Clock className="w-4 h-4" />}
        title="Planejado x Realizado"
        subtitle="Sem apontamentos"
      >
        <div className="flex items-center justify-center h-[240px] text-minerva-navy/40 dark:text-white/40 text-sm">
          Nenhum apontamento RPA encontrado
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      icon={<Clock className="w-4 h-4" />}
      title="Planejado x Realizado"
      subtitle="Horas por colaborador RPA"
      actions={
        <div className="text-right text-xs text-minerva-navy/65 dark:text-white/65">
          <p>
            <span className="text-minerva-navy/55 dark:text-white/55">Plan.</span>{' '}
            <span className="font-semibold text-minerva-navy dark:text-white tabular-nums">
              {formatHoursMinutes(totalPlanned)}
            </span>
          </p>
          <p>
            <span className="text-minerva-navy/55 dark:text-white/55">Real.</span>{' '}
            <span className="font-semibold text-emerald-600 dark:text-emerald-300 tabular-nums">
              {formatHoursMinutes(totalRealized)}
            </span>
          </p>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ left: -8, right: 12, top: 4, bottom: 18 }}>
          <ChartGradients />
          <CartesianGrid strokeDasharray="3 3" stroke={getGridStroke(isDark)} vertical={false} />
          <XAxis
            dataKey="displayName"
            angle={-15}
            textAnchor="end"
            height={56}
            {...getAxisProps(isDark)}
          />
          <YAxis {...getAxisProps(isDark)} />
          <Tooltip
            content={
              <GlassTooltip
                renderItem={item => (
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
                      {item.name}
                    </span>
                    <span className="font-bold tabular-nums text-minerva-navy dark:text-white">
                      {formatHoursMinutes(Number(item.value || 0))}
                    </span>
                  </div>
                )}
                formatLabel={(label: string) => label}
              />
            }
            cursor={{ fill: getCursorFill(isDark) }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ paddingTop: 8, fontSize: 12 }}
            formatter={value => (
              <span className="text-minerva-navy/80 dark:text-white/80">{value}</span>
            )}
          />
          <Bar
            dataKey="planned"
            name="Planejado"
            fill={isDark ? GRADIENT.bar('sky') : GRADIENT.bar('navy')}
            radius={[6, 6, 0, 0]}
            animationDuration={800}
            stroke={isDark ? CHART_PALETTE.skyLight : CHART_PALETTE.navy}
            strokeOpacity={0.2}
          />
          <Bar
            dataKey="realized"
            name="Realizado"
            fill={GRADIENT.bar('emerald')}
            radius={[6, 6, 0, 0]}
            animationDuration={800}
          />
          <Bar
            dataKey="legacy"
            name="Legado"
            fill={GRADIENT.bar('amber')}
            radius={[6, 6, 0, 0]}
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
