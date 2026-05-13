import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users } from 'lucide-react';
import { useTheme } from '../contexts/useTheme';
import {
  ChartCard,
  ChartGradients,
  GlassTooltip,
  fillForRank,
  getAxisProps,
  getGridStroke,
  getCursorFill,
} from './charts/chartTheme';

interface TechnicianChartProps {
  data: { technician: string; count: number }[];
  onSelectTechnician?: (technician: string) => void;
  selectedTechnicians?: string[];
}

function truncateName(name: string, maxLength = 18): string {
  if (!name || name === 'null' || name === 'undefined') return 'Não atribuído';
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength) + '…';
}

function formatTechnicianName(name: string): string {
  if (!name || name === 'null' || name === 'undefined') return 'Não atribuído';
  const cleanName = name.trim();
  if (/^\d+$/.test(cleanName)) return `Técnico #${cleanName}`;
  if (cleanName.includes(',')) {
    const parts = cleanName.split(',').map(p => p.trim());
    return truncateName(`${parts[1]} ${parts[0]}`);
  }
  return truncateName(cleanName);
}

export default function TechnicianChart({
  data,
  onSelectTechnician,
  selectedTechnicians,
}: TechnicianChartProps) {
  const { isDark } = useTheme();
  const selectedSet = new Set(selectedTechnicians ?? []);

  const displayData = data
    .filter(d => d.technician && d.technician !== 'null' && d.technician !== '')
    .slice(0, 10)
    .map((d, i) => ({
      ...d,
      displayName: formatTechnicianName(d.technician),
      fullName: d.technician,
      color: fillForRank(i),
    }));

  const total = displayData.reduce((sum, item) => sum + item.count, 0);

  if (displayData.length === 0) {
    return (
      <ChartCard
        icon={<Users className="w-4 h-4" />}
        title="Chamados por Técnico"
        subtitle="Sem dados"
      >
        <div className="flex items-center justify-center h-[260px] text-minerva-navy/40 dark:text-white/40 text-sm">
          Nenhum técnico encontrado
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      icon={<Users className="w-4 h-4" />}
      title="Chamados por Técnico"
      subtitle={`Top ${displayData.length} técnicos`}
      actions={
        <div className="text-right">
          <p className="text-2xl font-bold gradient-text tabular-nums leading-none">{total}</p>
          <p className="text-[11px] text-minerva-navy/55 dark:text-white/55 leading-tight">
            atendidos
          </p>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={displayData} layout="vertical" margin={{ left: 8, right: 16, top: 4 }}>
          <ChartGradients />
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={getGridStroke(isDark)}
            horizontal
            vertical={false}
          />
          <XAxis type="number" allowDecimals={false} {...getAxisProps(isDark)} />
          <YAxis
            dataKey="displayName"
            type="category"
            width={140}
            {...getAxisProps(isDark)}
            tick={{
              fontSize: 11,
              fill: isDark ? '#cbd5e1' : '#1D2E40',
              fontWeight: 500,
            }}
          />
          <Tooltip
            content={
              <GlassTooltip
                renderItem={item => {
                  const payload = item.payload as { fullName?: string } | undefined;
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
                        {payload?.fullName ?? 'Técnico'}
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
            radius={[0, 8, 8, 0]}
            animationDuration={800}
            onClick={payload => {
              const tech = (payload as { fullName?: string }).fullName;
              if (tech && onSelectTechnician) onSelectTechnician(tech);
            }}
            cursor={onSelectTechnician ? 'pointer' : 'default'}
          >
            {displayData.map((entry, index) => {
              const isSelected = selectedSet.has(entry.fullName);
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
      {onSelectTechnician && (
        <p className="text-[11px] text-minerva-navy/45 dark:text-white/45 mt-3">
          Clique em uma barra para filtrar.
        </p>
      )}
    </ChartCard>
  );
}
