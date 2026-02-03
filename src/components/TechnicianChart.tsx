import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface TechnicianChartProps {
  data: { technician: string; count: number }[];
}

function truncateName(name: string, maxLength: number = 18): string {
  if (!name || name === 'null' || name === 'undefined') return 'Não atribuído';
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength) + '...';
}

function formatTechnicianName(name: string): string {
  if (!name || name === 'null' || name === 'undefined') return 'Não atribuído';
  
  const cleanName = name.trim();
  
  if (/^\d+$/.test(cleanName)) {
    return `Técnico #${cleanName}`;
  }
  
  if (cleanName.includes(',')) {
    const parts = cleanName.split(',').map(p => p.trim());
    return truncateName(`${parts[1]} ${parts[0]}`);
  }
  
  return truncateName(cleanName);
}

// Gradiente de cores Minerva - Light Mode
const COLORS_LIGHT = [
  '#1D2E40', // Navy
  '#F84454', // Red
  '#2a4158', // Navy light
  '#ff6b78', // Red light
  '#3d5a7a', // Navy lighter
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
];

// Gradiente de cores para Dark Mode (mais vibrantes)
const COLORS_DARK = [
  '#60a5fa', // Blue
  '#F84454', // Red
  '#34d399', // Green
  '#fbbf24', // Amber
  '#a78bfa', // Purple
  '#22d3ee', // Cyan
  '#f472b6', // Pink
  '#fb923c', // Orange
  '#4ade80', // Light Green
  '#c084fc', // Light Purple
];

export default function TechnicianChart({ data }: TechnicianChartProps) {
  const { isDark } = useTheme();
  
  const displayData = data
    .filter(d => d.technician && d.technician !== 'null' && d.technician !== '')
    .slice(0, 10)
    .map(d => ({
      ...d,
      displayName: formatTechnicianName(d.technician),
      fullName: d.technician,
    }));

  const total = displayData.reduce((sum, item) => sum + item.count, 0);

  if (displayData.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-minerva p-6 h-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-minerva-red/10 dark:bg-minerva-red/20 rounded-xl">
            <Users className="w-5 h-5 text-minerva-red" />
          </div>
          <h2 className="text-lg font-semibold text-minerva-navy dark:text-white">Chamados por Técnico</h2>
        </div>
        <div className="flex items-center justify-center h-[280px] text-gray-400 dark:text-gray-500">
          Nenhum técnico encontrado
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-minerva p-6 card-hover">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-minerva-red/10 dark:bg-minerva-red/20 rounded-xl">
            <Users className="w-5 h-5 text-minerva-red" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-minerva-navy dark:text-white">Chamados por Técnico</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Top {displayData.length} técnicos</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-minerva-navy dark:text-white">{total}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">total atendidos</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={displayData} layout="vertical" margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#475569' : '#e2e8f0'} horizontal={true} vertical={false} />
          <XAxis 
            type="number" 
            tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} 
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            dataKey="displayName" 
            type="category" 
            tick={{ fontSize: 11, fill: isDark ? '#e2e8f0' : '#1D2E40' }} 
            width={140}
            tickLine={false}
            axisLine={false}
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
              <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{props.payload.fullName || 'Técnico'}</span>
            ]}
            labelFormatter={() => ''}
            cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(29, 46, 64, 0.05)' }}
          />
          <Bar dataKey="count" radius={[0, 8, 8, 0]}>
            {displayData.map((_, index) => {
              const colors = isDark ? COLORS_DARK : COLORS_LIGHT;
              return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
