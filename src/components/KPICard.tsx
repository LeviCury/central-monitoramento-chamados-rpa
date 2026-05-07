import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { ReactNode } from 'react';

export type KPIColor = 'navy' | 'green' | 'amber' | 'red' | 'violet';

export interface KPICardProps {
  title: string;
  value: number | string;
  /** Subtítulo simples (1 linha curta). */
  subtitle?: string;
  /** Subtítulo customizado (ReactNode) — substitui `subtitle` quando presente. */
  subtitleNode?: ReactNode;
  /** Mini-pílulas no rodapé (ex.: Incidente 5 · Requisição 4). */
  breakdown?: ReactNode;
  icon: ReactNode;
  color?: KPIColor;
  delay?: number;
  large?: boolean;
  /**
   * Variação percentual vs período anterior. Quando `null`/`undefined`
   * o card simplesmente não exibe o trecho de comparação.
   *
   * IMPORTANTE: só passe `delta` quando a comparação fizer sentido para
   * o KPI. Para snapshots instantâneos (em aberto, parados, médias) a
   * comparação com o período anterior gera ruído (variações de centenas
   * de %) sem informação real — não passe `delta` nesses casos.
   */
  delta?: number | null;
  /** Direção desejada (true: subir é bom, false: descer é bom). */
  positiveIsGood?: boolean;
  /** Skeleton/loading. */
  loading?: boolean;
}

const COLOR_STYLES: Record<KPIColor, { bg: string; subtext: string; deltaSurface: string }> = {
  navy: {
    bg: 'bg-gradient-to-br from-minerva-navy to-minerva-navy-light',
    subtext: 'text-white/70',
    deltaSurface: 'bg-white/10',
  },
  green: {
    bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    subtext: 'text-white/80',
    deltaSurface: 'bg-white/15',
  },
  amber: {
    bg: 'bg-gradient-to-br from-amber-400 to-amber-500',
    subtext: 'text-white/85',
    deltaSurface: 'bg-white/20',
  },
  red: {
    bg: 'bg-gradient-to-br from-minerva-red to-minerva-red-dark',
    subtext: 'text-white/85',
    deltaSurface: 'bg-white/15',
  },
  violet: {
    bg: 'bg-gradient-to-br from-violet-500 to-violet-600',
    subtext: 'text-white/80',
    deltaSurface: 'bg-white/15',
  },
};

interface DeltaRowProps {
  delta: number;
  positiveIsGood?: boolean;
  surfaceClass: string;
  large?: boolean;
}

function DeltaRow({ delta, positiveIsGood = true, surfaceClass, large = false }: DeltaRowProps) {
  const isFlat = delta === 0;
  const isUp = delta > 0;
  const isGood = isFlat ? null : positiveIsGood ? isUp : !isUp;

  const Icon = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight;
  const valueColor = isFlat
    ? 'text-white/90'
    : isGood
      ? 'text-emerald-100'
      : 'text-rose-100';

  const sign = isUp ? '+' : '';
  const formatted = `${sign}${delta}%`;

  return (
    <div
      className={`mt-3 flex items-center gap-2 rounded-lg ${surfaceClass} px-2.5 py-1.5`}
      role="group"
      aria-label="Variação vs período anterior"
    >
      <Icon className={`${large ? 'w-4 h-4' : 'w-3.5 h-3.5'} ${valueColor}`} aria-hidden />
      <span className={`${large ? 'text-base' : 'text-sm'} font-semibold ${valueColor} tabular-nums`}>
        {formatted}
      </span>
      <span className={`text-[10px] uppercase tracking-wide ${large ? 'text-xs' : ''} text-white/70 leading-tight`}>
        vs período anterior
      </span>
    </div>
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
    : 'text-[11px] font-semibold uppercase tracking-wider';
  const valueClass = large ? 'text-5xl' : 'text-4xl';
  const subtitleClass = large ? 'text-base' : 'text-xs';

  return (
    <div
      className={`${styles.bg} rounded-2xl ${large ? 'p-7' : 'p-5'} shadow-minerva-lg card-hover animate-fade-in transition-all text-white flex flex-col`}
      style={{ animationDelay: `${delay * 0.1}s` }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={`${titleClass} ${styles.subtext} leading-snug`}>{title}</p>
        <div className={`${large ? 'p-3' : 'p-2.5'} bg-white/20 rounded-xl shrink-0`}>{icon}</div>
      </div>

      {loading ? (
        <div className={`${large ? 'h-12 w-32 mt-4' : 'h-10 w-24 mt-3'} rounded-xl bg-white/20 animate-pulse`} />
      ) : (
        <p className={`${valueClass} font-bold tracking-tight mt-2 leading-none`}>
          {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
        </p>
      )}

      {subtitleNode ? (
        <div className="mt-3">{subtitleNode}</div>
      ) : (
        subtitle && (
          <p className={`${subtitleClass} ${styles.subtext} mt-2`}>
            {subtitle}
          </p>
        )
      )}

      {delta !== null && delta !== undefined && Number.isFinite(delta) && (
        <DeltaRow
          delta={delta}
          positiveIsGood={positiveIsGood}
          surfaceClass={styles.deltaSurface}
          large={large}
        />
      )}

      {breakdown && (
        <div className="mt-auto pt-4 border-t border-white/15 flex flex-wrap gap-1.5">
          {breakdown}
        </div>
      )}
    </div>
  );
}
