import { Activity } from 'lucide-react';
import { HeatmapCell } from '../services/analytics';
import { useTheme } from '../contexts/useTheme';

interface HeatmapProps {
  data: HeatmapCell[];
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function colorScale(intensity: number, isDark: boolean): string {
  if (intensity === 0) return isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(148, 163, 184, 0.12)';
  // 0..1 -> red Minerva
  const opacity = 0.15 + intensity * 0.85;
  return isDark
    ? `rgba(248, 68, 84, ${opacity})`
    : `rgba(248, 68, 84, ${opacity})`;
}

export function Heatmap({ data }: HeatmapProps) {
  const { isDark } = useTheme();
  const max = Math.max(...data.map(c => c.count), 1);

  const cellByKey = new Map<string, HeatmapCell>();
  for (const c of data) cellByKey.set(`${c.weekday}-${c.hour}`, c);

  const total = data.reduce((s, c) => s + c.count, 0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-minerva p-6 card-hover">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/10 dark:bg-violet-500/20 rounded-xl">
            <Activity className="w-5 h-5 text-violet-500" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-minerva-navy dark:text-white">
              Heatmap de Aberturas
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Concentração de chamados por dia e hora
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-minerva-navy dark:text-white">{total}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">no período</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table
          className="w-full text-xs"
          aria-label="Mapa de calor de chamados por dia da semana e hora"
        >
          <thead>
            <tr>
              <th className="w-12" aria-label="Dia da semana"></th>
              {HOURS.map(h => (
                <th
                  key={h}
                  className={`text-center text-gray-400 dark:text-gray-500 font-medium ${h % 2 === 0 ? '' : 'opacity-0'}`}
                  scope="col"
                >
                  {h}h
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((label, weekday) => (
              <tr key={weekday}>
                <th
                  scope="row"
                  className="text-right pr-2 text-gray-500 dark:text-gray-400 font-medium"
                >
                  {label}
                </th>
                {HOURS.map(hour => {
                  const cell = cellByKey.get(`${weekday}-${hour}`);
                  const count = cell?.count ?? 0;
                  const intensity = count / max;
                  return (
                    <td key={hour} className="p-0.5">
                      <div
                        className="w-full aspect-square rounded-md flex items-center justify-center"
                        style={{ backgroundColor: colorScale(intensity, isDark) }}
                        title={`${label} ${hour}:00 — ${count} chamado${count === 1 ? '' : 's'}`}
                        aria-label={`${label} ${hour}h: ${count} chamados`}
                      >
                        {count > 0 && intensity > 0.55 && (
                          <span className="text-[10px] font-semibold text-white">{count}</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4 text-xs text-gray-500 dark:text-gray-400">
        <span>menos</span>
        <div className="flex gap-1">
          {[0.1, 0.3, 0.5, 0.75, 1].map((v, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded"
              style={{ backgroundColor: colorScale(v, isDark) }}
              aria-hidden
            />
          ))}
        </div>
        <span>mais</span>
      </div>
    </div>
  );
}
