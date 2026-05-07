import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { ReactNode } from 'react';

export type KPIColor = 'navy' | 'green' | 'amber' | 'red' | 'violet';

export interface KPICardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  /** Subtítulo customizado (ReactNode) — sobrepõe `subtitle` quando presente. */
  subtitleNode?: ReactNode;
  /** Mini-pílulas no rodapé (ex.: Inc 5 · Req 4). */
  breakdown?: ReactNode;
  icon: ReactNode;
  color?: KPIColor;
  delay?: number;
  large?: boolean;
  /** Variação percentual vs período anterior. */
  delta?: number | null;
  /** Direção desejada (true: subir é bom, false: descer é bom). */
  positiveIsGood?: boolean;
  /** Skeleton/loading. */
  loading?: boolean;
}

const COLOR_STYLES: Record<KPIColor, { bg: string; subtext: string }> = {
  navy: {
    bg: 'bg-gradient-to-br from-minerva-navy to-minerva-navy-light',
    subtext: 'text-white/70',
  },
  green: {
    bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    subtext: 'text-white/80',
  },
  amber: {
    bg: 'bg-gradient-to-br from-amber-400 to-amber-500',
    subtext: 'text-white/80',
  },
  red: {
    bg: 'bg-gradient-to-br from-minerva-red to-minerva-red-dark',
    subtext: 'text-white/80',
  },
  violet: {
    bg: 'bg-gradient-to-br from-violet-500 to-violet-600',
    subtext: 'text-white/80',
  },
};

function DeltaBadge({ delta, positiveIsGood = true }: { delta: number; positiveIsGood?: boolean }) {
  const sign = delta > 0 ? '+' : '';
  const fullLabel = `${sign}${delta}% vs período anterior`;

  if (delta === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-white/20 text-white"
        title="Sem variação vs período anterior"
        aria-label="Sem variação vs período anterior"
      >
        <Minus className="w-3 h-3" aria-hidden />
        0%
      </span>
    );
  }
  const isUp = delta > 0;
  const isGood = positiveIsGood ? isUp : !isUp;
  const tone = isGood
    ? 'bg-emerald-500/30 text-emerald-100'
    : 'bg-red-500/30 text-red-100';
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${tone}`}
      aria-label={fullLabel}
      title={fullLabel}
    >
      <Icon className="w-3 h-3" aria-hidden />
      {sign}
      {delta}%
    </span>
  );
}

export function KPICard({
  title,
  value,
  subtitle,
  subtitleNode,
  breakdown,
  icon,
  color = 'navy',
  delay = 0,
  large = false,
  delta = null,
  positiveIsGood = true,
  loading = false,
}: KPICardProps) {
  const styles = COLOR_STYLES[color];

  const titleClass = large
    ? 'text-sm font-semibold uppercase tracking-wide'
    : 'text-xs font-semibold uppercase tracking-wide';
  const valueClass = large ? 'text-5xl' : 'text-3xl';
  const subtitleClass = large ? 'text-base' : 'text-xs';

  return (
    <div
      className={`${styles.bg} rounded-2xl ${large ? 'p-8' : 'p-5'} shadow-minerva-lg card-hover animate-fade-in transition-all text-white flex flex-col`}
      style={{ animationDelay: `${delay * 0.1}s` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className={`${titleClass} ${styles.subtext}`}>{title}</p>
          {loading ? (
            <div className={`${large ? 'h-12 w-32 mt-3' : 'h-9 w-20 mt-2'} rounded-xl bg-white/20 animate-pulse`} />
          ) : (
            <p className={`${valueClass} font-bold tracking-tight mt-2 leading-none`}>
              {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
            </p>
          )}
          {subtitleNode ? (
            <div className="mt-2">{subtitleNode}</div>
          ) : (
            subtitle && (
              <p className={`${subtitleClass} ${styles.subtext} mt-2 truncate`} title={subtitle}>
                {subtitle}
              </p>
            )
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className={`${large ? 'p-3' : 'p-2.5'} bg-white/20 rounded-xl`}>{icon}</div>
          {delta !== null && delta !== undefined && (
            <DeltaBadge delta={delta} positiveIsGood={positiveIsGood} />
          )}
        </div>
      </div>
      {breakdown && (
        <div className="mt-3 pt-3 border-t border-white/15 flex flex-wrap gap-1.5">
          {breakdown}
        </div>
      )}
    </div>
  );
}
