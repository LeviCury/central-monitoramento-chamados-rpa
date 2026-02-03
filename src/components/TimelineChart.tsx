import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface TimelineChartProps {
  data: { date: string; count: number }[];
}

export default function TimelineChart({ data }: TimelineChartProps) {
  const { isDark } = useTheme();
  
  const formattedData = data.map(item => ({
    ...item,
    displayDate: new Date(item.date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }),
  }));

  const total = data.reduce((sum, item) => sum + item.count, 0);
  const average = data.length > 0 ? Math.round(total / data.length * 10) / 10 : 0;
  const max = Math.max(...data.map(d => d.count), 0);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-minerva p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold text-minerva-navy dark:text-white">Evolução de Chamados</h2>
        </div>
        <div className="flex items-center justify-center h-[200px] text-gray-400 dark:text-gray-500">
          Nenhum dado disponível para o período
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-minerva p-6 card-hover">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-minerva-navy dark:text-white">Evolução de Chamados</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Chamados abertos por dia</p>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-2xl font-bold text-minerva-navy dark:text-white">{total}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">total no período</p>
          </div>
          <div className="h-10 w-px bg-gray-200 dark:bg-slate-600"></div>
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-600">{average}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">média/dia</p>
          </div>
          <div className="h-10 w-px bg-gray-200 dark:bg-slate-600"></div>
          <div className="text-right">
            <p className="text-2xl font-bold text-minerva-red">{max}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">pico máximo</p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={formattedData} margin={{ left: -10, right: 10 }}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isDark ? '#60a5fa' : '#1D2E40'} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={isDark ? '#60a5fa' : '#1D2E40'} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#475569' : '#e2e8f0'} vertical={false} />
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
                const data = payload[0].payload;
                return (
                  <div style={{ 
                    backgroundColor: isDark ? '#1e293b' : '#fff', 
                    padding: '12px 16px', 
                    borderRadius: '12px', 
                    border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`, 
                    boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.3)' 
                  }}>
                    <p style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '12px', marginBottom: '4px' }}>
                      Data: {data.displayDate}
                    </p>
                    <p style={{ color: isDark ? '#f1f5f9' : '#1D2E40', fontSize: '16px', fontWeight: 700 }}>
                      {data.count} {data.count === 1 ? 'chamado' : 'chamados'}
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
            activeDot={{ r: 6, fill: '#F84454', strokeWidth: 2, stroke: isDark ? '#1e293b' : '#fff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
