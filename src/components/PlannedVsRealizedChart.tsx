import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Clock } from 'lucide-react';
import { useTheme } from '../contexts/useTheme';
import { formatHoursMinutes } from '../utils/timeFormat';

interface PlannedVsRealizedChartProps {
  data: { collaborator: string; planned: number; realized: number; legacy: number }[];
}

function truncateName(name: string, maxLength: number = 18): string {
  if (name.length <= maxLength) return name;
  return `${name.substring(0, maxLength)}...`;
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
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-minerva p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-minerva-red/10 dark:bg-minerva-red/20 rounded-xl">
            <Clock className="w-5 h-5 text-minerva-red" />
          </div>
          <h2 className="text-lg font-semibold text-minerva-navy dark:text-white">Planejado x Realizado</h2>
        </div>
        <div className="flex items-center justify-center h-[260px] text-gray-400 dark:text-gray-500">
          Nenhum apontamento RPA encontrado
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-minerva p-6 card-hover">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-minerva-red/10 dark:bg-minerva-red/20 rounded-xl">
            <Clock className="w-5 h-5 text-minerva-red" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-minerva-navy dark:text-white">Planejado x Realizado</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Horas por colaborador RPA</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Plan. {formatHoursMinutes(totalPlanned)} | Real. {formatHoursMinutes(totalRealized)}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ left: -10, right: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#475569' : '#e2e8f0'} vertical={false} />
          <XAxis
            dataKey="displayName"
            tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
            axisLine={{ stroke: isDark ? '#475569' : '#e2e8f0' }}
            tickLine={false}
            angle={-15}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
              borderRadius: '12px',
              boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.3)',
              padding: '12px 16px',
            }}
            formatter={(value, name) => [
              <span style={{ color: isDark ? '#f1f5f9' : '#1D2E40', fontWeight: 600 }}>
                {formatHoursMinutes(Number(value || 0))}
              </span>,
              String(name),
            ]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.collaborator ?? ''}
            cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(29, 46, 64, 0.05)' }}
          />
          <Legend />
          <Bar dataKey="planned" name="Planejado" fill={isDark ? '#60a5fa' : '#1D2E40'} radius={[6, 6, 0, 0]} />
          <Bar dataKey="realized" name="Realizado" fill="#10B981" radius={[6, 6, 0, 0]} />
          <Bar dataKey="legacy" name="Legado" fill="#F59E0B" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
