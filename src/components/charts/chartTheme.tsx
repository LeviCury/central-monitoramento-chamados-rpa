/**
 * Tema unificado dos charts (Recharts) — paleta canônica, GlassTooltip,
 * gradient defs reutilizáveis e helper de wrapper para que todos os
 * blocos de chart compartilhem o mesmo "look" Executive Premium.
 *
 * Uso típico em um chart:
 *
 *   import { ChartCard, GlassTooltip, ChartGradients, CHART_PALETTE,
 *     fillForStatus } from './charts/chartTheme';
 *
 *   <ChartCard icon={<PieChart />} title="..." subtitle="...">
 *     <ResponsiveContainer ...>
 *       <BarChart>
 *         <ChartGradients />
 *         <Tooltip content={<GlassTooltip />} />
 *         <Bar fill="url(#brandBarGradient)" />
 *       </BarChart>
 *     </ResponsiveContainer>
 *   </ChartCard>
 */
import { ReactNode } from 'react';
import { TooltipProps } from 'recharts';

// ============================================================
// Paleta canônica
// ============================================================

export const CHART_PALETTE = {
  navy: '#1D2E40',
  navyLight: '#2a4158',
  red: '#F84454',
  redDark: '#d63644',
  emerald: '#10b981',
  emeraldLight: '#34d399',
  amber: '#f59e0b',
  amberLight: '#fbbf24',
  violet: '#8b5cf6',
  violetLight: '#a78bfa',
  sky: '#0ea5e9',
  skyLight: '#38bdf8',
  rose: '#f43f5e',
  roseLight: '#fb7185',
  slate: '#94a3b8',
  slateLight: '#cbd5e1',
} as const;

const STATUS_COLORS: Record<string, string> = {
  Fechado: CHART_PALETTE.emerald,
  Solucionado: CHART_PALETTE.sky,
  Novo: CHART_PALETTE.violet,
  'Em Atendimento (atribuído)': CHART_PALETTE.red,
  'Em Atendimento (planejado)': CHART_PALETTE.amber,
  Pendente: CHART_PALETTE.rose,
};

const TYPE_COLORS: Record<string, string> = {
  incident: CHART_PALETTE.rose,
  request: CHART_PALETTE.sky,
  unknown: CHART_PALETTE.slate,
};

export function fillForStatus(status: string): string {
  return STATUS_COLORS[status] ?? CHART_PALETTE.slate;
}

export function fillForType(type: string): string {
  return TYPE_COLORS[type] ?? CHART_PALETTE.slate;
}

// Gerador determinístico de cor (paleta fixa) para n itens — usado
// em rankings tipo "técnicos" onde não há mapeamento semântico.
const RANKED_PALETTE = [
  CHART_PALETTE.red,
  CHART_PALETTE.violet,
  CHART_PALETTE.emerald,
  CHART_PALETTE.amber,
  CHART_PALETTE.sky,
  CHART_PALETTE.rose,
  CHART_PALETTE.navyLight,
  CHART_PALETTE.violetLight,
  CHART_PALETTE.emeraldLight,
  CHART_PALETTE.amberLight,
];

export function fillForRank(index: number): string {
  return RANKED_PALETTE[index % RANKED_PALETTE.length];
}

// ============================================================
// Gradient defs reutilizáveis
// Importe `<ChartGradients />` dentro do `<BarChart>` / `<AreaChart>`
// e referencie por id: `fill="url(#barNavy)"`.
// ============================================================

export function ChartGradients() {
  return (
    <defs>
      {/* Bars verticais — cada cor com gradient suave do topo p/ baixo */}
      {Object.entries({
        navy: [CHART_PALETTE.navy, CHART_PALETTE.navyLight],
        red: [CHART_PALETTE.red, CHART_PALETTE.redDark],
        emerald: [CHART_PALETTE.emeraldLight, CHART_PALETTE.emerald],
        amber: [CHART_PALETTE.amberLight, CHART_PALETTE.amber],
        violet: [CHART_PALETTE.violetLight, CHART_PALETTE.violet],
        sky: [CHART_PALETTE.skyLight, CHART_PALETTE.sky],
        rose: [CHART_PALETTE.roseLight, CHART_PALETTE.rose],
        slate: [CHART_PALETTE.slate, '#64748b'],
      }).map(([key, [from, to]]) => (
        <linearGradient key={key} id={`bar-${key}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={from} stopOpacity={0.95} />
          <stop offset="100%" stopColor={to} stopOpacity={0.85} />
        </linearGradient>
      ))}

      {/* Áreas — gradient vertical de cor para transparente */}
      {Object.entries({
        navy: CHART_PALETTE.navy,
        red: CHART_PALETTE.red,
        emerald: CHART_PALETTE.emerald,
        violet: CHART_PALETTE.violet,
        sky: CHART_PALETTE.sky,
      }).map(([key, color]) => (
        <linearGradient key={key} id={`area-${key}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.40} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      ))}
    </defs>
  );
}

export const GRADIENT = {
  bar: (key: 'navy' | 'red' | 'emerald' | 'amber' | 'violet' | 'sky' | 'rose' | 'slate') =>
    `url(#bar-${key})`,
  area: (key: 'navy' | 'red' | 'emerald' | 'violet' | 'sky') => `url(#area-${key})`,
};

// ============================================================
// GlassTooltip — tooltip premium para todos os charts
// ============================================================

interface GlassTooltipExtraProps {
  /** Customizador de label (data, x, etc.) */
  formatLabel?: (label: string) => string;
  /** Customizador de cada item — recebe payload e devolve nó. */
  renderItem?: (item: TooltipPayloadItem) => ReactNode;
}

interface TooltipPayloadItem {
  name?: string;
  dataKey?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

export function GlassTooltip(
  props: TooltipProps<number | string, string> & GlassTooltipExtraProps
) {
  const { active, payload, label, formatLabel, renderItem } = props;

  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      role="tooltip"
      className="glass-strong rounded-xl px-3 py-2 min-w-[160px] text-xs shadow-soft"
      style={{ pointerEvents: 'none' }}
    >
      {label && (
        <p className="text-[10px] uppercase tracking-wider-2 text-[var(--text-tertiary)] font-semibold mb-1.5">
          {formatLabel ? formatLabel(String(label)) : String(label)}
        </p>
      )}
      <ul className="space-y-1">
        {payload.map((item, idx) => {
          const it = item as TooltipPayloadItem;
          if (renderItem) {
            return <li key={idx}>{renderItem(it)}</li>;
          }
          return (
            <li key={idx} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: it.color ?? CHART_PALETTE.navy }}
                aria-hidden
              />
              {it.name && (
                <span className="text-[var(--text-secondary)] mr-auto">{it.name}</span>
              )}
              <span className="font-semibold tnum text-[var(--text-primary)]">
                {typeof it.value === 'number'
                  ? it.value.toLocaleString('pt-BR')
                  : it.value}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============================================================
// ChartCard — wrapper consistente com header (ícone + título + ação)
// ============================================================

interface ChartCardProps {
  icon?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  /** Slot do canto direito do header (ex: stats inline, botões). */
  actions?: ReactNode;
  /** Quando true, remove padding interno (útil pra heatmap). */
  flush?: boolean;
  /** Densidade vertical menor (cards de dashboard secundários). */
  compact?: boolean;
  className?: string;
  children: ReactNode;
}

export function ChartCard({
  icon,
  title,
  subtitle,
  actions,
  flush = false,
  compact = false,
  className = '',
  children,
}: ChartCardProps) {
  return (
    <section className={`surface-elevated rounded-3xl overflow-hidden ${className}`}>
      <header
        className={`flex items-start justify-between gap-4 ${compact ? 'px-5 pt-4 pb-3' : 'px-7 pt-6 pb-4'}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)] shrink-0">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)] tracking-[-0.01em] truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[var(--text-tertiary)] leading-tight mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </header>
      <div className={flush ? '' : compact ? 'px-5 pb-5' : 'px-7 pb-7'}>{children}</div>
    </section>
  );
}

// ============================================================
// Tokens auxiliares para axes (mantém visual coerente)
// ============================================================

export function getAxisProps(isDark: boolean) {
  return {
    tick: {
      fontSize: 11,
      fill: isDark ? '#71717a' : '#71717a',
      fontWeight: 500,
    },
    axisLine: false as const,
    tickLine: false as const,
  };
}

export function getGridStroke(isDark: boolean) {
  return isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
}

export function getCursorFill(isDark: boolean) {
  return isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)';
}
