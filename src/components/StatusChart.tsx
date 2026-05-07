import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PieChart } from 'lucide-react';
import { useTheme } from '../contexts/useTheme';

interface StatusChartProps {
  data: { status: string; count: number }[];
  onSelectStatus?: (status: string) => void;
  selectedStatuses?: string[];
}

// Cores com a paleta Minerva - Light Mode
const STATUS_COLORS_LIGHT: Record<string, string> = {
  'Fechado': '#10b981',
  'Solucionado': '#1D2E40',
  'Novo': '#8b5cf6',
  'Em Atendimento (atribuído)': '#F84454',
  'Em Atendimento (planejado)': '#f59e0b',
  'Pendente': '#ef4444',
};

// Cores para Dark Mode (mais vibrantes)
const STATUS_COLORS_DARK: Record<string, string> = {
  'Fechado': '#34d399',
  'Solucionado': '#60a5fa',
  'Novo': '#a78bfa',
  'Em Atendimento (atribuído)': '#F84454',
  'Em Atendimento (planejado)': '#fbbf24',
  'Pendente': '#f87171',
};

const DEFAULT_COLOR_LIGHT = '#94a3b8';
const DEFAULT_COLOR_DARK = '#cbd5e1';

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
  
  const statusColors = isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
  const defaultColor = isDark ? DEFAULT_COLOR_DARK : DEFAULT_COLOR_LIGHT;
  
  const chartData = data.map(item => ({
    ...item,
    displayStatus: formatStatus(item.status),
    color: statusColors[item.status] || defaultColor,
  }));

  const total = chartData.reduce((sum, item) => sum + item.count, 0);

  if (chartData.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-minerva p-6 h-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-minerva-navy/10 dark:bg-white/10 rounded-xl">
            <PieChart className="w-5 h-5 text-minerva-navy dark:text-white" />
          </div>
          <h2 className="text-lg font-semibold text-minerva-navy dark:text-white">Distribuição por Status</h2>
        </div>
        <div className="flex items-center justify-center h-[280px] text-gray-400 dark:text-gray-500">
          Nenhum dado disponível
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-minerva p-6 card-hover">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-minerva-navy/10 dark:bg-white/10 rounded-xl">
            <PieChart className="w-5 h-5 text-minerva-navy dark:text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-minerva-navy dark:text-white">Distribuição por Status</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{total} chamados no total</p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ bottom: 20, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#475569' : '#e2e8f0'} vertical={false} />
          <XAxis 
            dataKey="displayStatus" 
            tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} 
            angle={-20}
            textAnchor="end"
            height={60}
            interval={0}
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
            contentStyle={{
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
              borderRadius: '12px',
              boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.3)',
              padding: '12px 16px',
            }}
            formatter={(value, _name, props) => [
              <span style={{ color: isDark ? '#f1f5f9' : '#1D2E40', fontWeight: 600 }}>{value} chamados</span>,
              <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{props.payload.status}</span>
            ]}
            labelFormatter={() => ''}
            cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(29, 46, 64, 0.05)' }}
          />
          <Bar
            dataKey="count"
            radius={[8, 8, 0, 0]}
            onClick={(payload) => {
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
                  fillOpacity={isDimmed ? 0.35 : 1}
                  stroke={isSelected ? '#F84454' : 'none'}
                  strokeWidth={isSelected ? 2 : 0}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      {/* Legenda clicável (drill-down) */}
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
        {chartData.map((item, index) => {
          const isSelected = selectedSet.has(item.status);
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelectStatus?.(item.status)}
              disabled={!onSelectStatus}
              aria-pressed={isSelected}
              className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-full transition-all ${
                isSelected
                  ? 'bg-minerva-navy text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300'
              } ${!onSelectStatus ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <span>{item.status}</span>
              <span className={`font-semibold ${isSelected ? 'text-white' : 'text-minerva-navy dark:text-white'}`}>
                ({item.count})
              </span>
            </button>
          );
        })}
      </div>
      {onSelectStatus && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Dica: clique em um status para filtrar.
        </p>
      )}
    </div>
  );
}
