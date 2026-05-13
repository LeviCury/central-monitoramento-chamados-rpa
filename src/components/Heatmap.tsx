import { Activity } from 'lucide-react';
import { useMemo, useState } from 'react';
import { HeatmapCell } from '../services/analytics';
import { ChartCard } from './charts/chartTheme';

interface HeatmapProps {
  data: HeatmapCell[];
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_FULL = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

/**
 * Escala monocromática vermelho Minerva. Intensidade vai de 0 (vazio
 * neutro) até 1 (vermelho saturado). Sem glow ou borda colorida —
 * Apple-style, profundidade vem só da opacidade.
 */
function cellStyle(intensity: number): React.CSSProperties {
  if (intensity === 0) {
    return { backgroundColor: 'var(--bg-subtle)' };
  }
  const opacity = 0.10 + intensity * 0.85;
  return {
    backgroundColor: `rgba(248, 68, 84, ${opacity})`,
  };
}

export function Heatmap({ data }: HeatmapProps) {
  const max = useMemo(() => Math.max(...data.map(c => c.count), 1), [data]);

  const cellByKey = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    for (const c of data) map.set(`${c.weekday}-${c.hour}`, c);
    return map;
  }, [data]);

  const total = useMemo(() => data.reduce((s, c) => s + c.count, 0), [data]);

  const [hover, setHover] = useState<{ weekday: number; hour: number } | null>(null);

  return (
    <ChartCard
      icon={<Activity className="w-4 h-4" />}
      title="Heatmap de Aberturas"
      subtitle="Concentração de chamados por dia × hora"
      actions={
        <div className="text-right">
          <p className="text-xl font-semibold text-[var(--text-primary)] tnum leading-none tracking-tighter-2">
            {total.toLocaleString('pt-BR')}
          </p>
          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider-2 mt-0.5">
            no período
          </p>
        </div>
      }
    >
      <div
        className="overflow-x-auto"
        onMouseLeave={() => setHover(null)}
      >
        <table
          className="w-full text-xs border-separate border-spacing-[3px]"
          aria-label="Mapa de calor de chamados por dia da semana e hora"
        >
          <thead>
            <tr>
              <th className="w-12 p-0" aria-label="Dia da semana"></th>
              {HOURS.map(h => {
                const isActive = hover?.hour === h;
                return (
                  <th
                    key={h}
                    scope="col"
                    className={`text-center text-[10px] font-semibold tnum transition-colors ${
                      isActive
                        ? 'text-[var(--text-primary)]'
                        : h % 2 === 0
                          ? 'text-[var(--text-tertiary)]'
                          : 'opacity-0'
                    }`}
                  >
                    {h}h
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((label, weekday) => {
              const isActiveRow = hover?.weekday === weekday;
              return (
                <tr key={weekday}>
                  <th
                    scope="row"
                    className={`text-right pr-2 text-[11px] font-semibold transition-colors ${
                      isActiveRow
                        ? 'text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {label}
                  </th>
                  {HOURS.map(hour => {
                    const cell = cellByKey.get(`${weekday}-${hour}`);
                    const count = cell?.count ?? 0;
                    const intensity = count / max;
                    const isActive = hover?.weekday === weekday && hover?.hour === hour;
                    const isCrosshair =
                      hover && (hover.weekday === weekday || hover.hour === hour);

                    return (
                      <td key={hour} className="p-0">
                        <div
                          className={[
                            'relative w-full aspect-square rounded-[5px] flex items-center justify-center cursor-pointer',
                            'transition-[transform,opacity] duration-150 ease-out',
                            isActive ? 'scale-[1.20] z-10' : '',
                            !isActive && hover && !isCrosshair ? 'opacity-50' : '',
                          ].join(' ')}
                          style={cellStyle(intensity)}
                          onMouseEnter={() => setHover({ weekday, hour })}
                          title={`${WEEKDAYS_FULL[weekday]} ${hour}h — ${count} chamado${count === 1 ? '' : 's'}`}
                          aria-label={`${WEEKDAYS_FULL[weekday]} ${hour}h: ${count} chamados`}
                        >
                          {isActive && count > 0 && (
                            <span className={`text-[10px] font-semibold tnum ${intensity > 0.5 ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                              {count}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-[var(--border-subtle)] flex-wrap gap-3">
        <div className="text-xs text-[var(--text-secondary)]">
          {hover ? (
            <span>
              <span className="font-semibold text-[var(--text-primary)]">
                {WEEKDAYS_FULL[hover.weekday]}
              </span>
              {' às '}
              <span className="font-semibold text-[var(--text-primary)] tnum">
                {hover.hour}h
              </span>
              {' · '}
              <span className="text-[var(--text-primary)] font-semibold tnum">
                {cellByKey.get(`${hover.weekday}-${hour(hover)}`)?.count ?? 0}
              </span>
              {' chamados'}
            </span>
          ) : (
            <span className="text-[var(--text-tertiary)]">Passe o mouse sobre uma célula para ver detalhes.</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider-2">
          <span>Menos</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.75, 1].map((v, i) => (
              <div
                key={i}
                className="w-3.5 h-3.5 rounded-[3px]"
                style={cellStyle(v)}
                aria-hidden
              />
            ))}
          </div>
          <span>Mais</span>
        </div>
      </div>
    </ChartCard>
  );
}

function hour(h: { hour: number }): number {
  return h.hour;
}
