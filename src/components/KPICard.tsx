import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { ReactNode } from 'react';
import { useCountUp } from '../hooks/useCountUp';

export type KPIColor = 'navy' | 'green' | 'amber' | 'red' | 'violet';

export interface KPICardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  subtitleNode?: ReactNode;
  breakdown?: ReactNode;
  icon: ReactNode;
  color?: KPIColor;
  delay?: number;
  large?: boolean;
  delta?: number | null;
  positiveIsGood?: boolean;
  loading?: boolean;
}

interface ColorTokens {
  iconBg: string;
  iconText: string;
}

/**
 * Cor é APENAS no quadradinho do ícone — não no fundo do card.
 * O card permanece neutro (Apple-style); a cor identifica a categoria
 * num único ponto, sem poluir.
 */
const COLOR_TOKENS: Record<KPIColor, ColorTokens> = {
  navy: {
    iconBg: 'bg-[var(--bg-subtle)]',
    iconText: 'text-[var(--text-primary)]',
  },
  green: {
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    iconText: 'text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    iconBg: 'bg-amber-500/10 dark:bg-amber-500/15',
    iconText: 'text-amber-600 dark:text-amber-400',
  },
  red: {
    iconBg: 'bg-rose-500/10 dark:bg-rose-500/15',
    iconText: 'text-rose-600 dark:text-rose-400',
  },
  violet: {
    iconBg: 'bg-violet-500/10 dark:bg-violet-500/15',
    iconText: 'text-violet-600 dark:text-violet-400',
  },
};

interface DeltaPillProps {
  delta: number;
  positiveIsGood?: boolean;
}

function DeltaPill({ delta, positiveIsGood = true }: DeltaPillProps) {
  const isFlat = delta === 0;
  const isUp = delta > 0;
  const isGood = isFlat ? null : positiveIsGood ? isUp : !isUp;

  const Icon = isFlat ? Minus : isUp ? ArrowUp : ArrowDown;
  const toneClass = isFlat
    ? 'text-[var(--text-tertiary)] bg-[var(--bg-subtle)]'
    : isGood
      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
      : 'text-rose-700 dark:text-rose-400 bg-rose-500/10';

  const sign = isUp ? '+' : '';
  const formatted = `${sign}${delta}%`;

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-semibold tnum ${toneClass}`}
      title={`${formatted} vs período anterior`}
    >
      <Icon className="w-2.5 h-2.5" aria-hidden strokeWidth={3} />
      {formatted}
    </span>
  );
}

function useAnimatedValue(value: number | string): string | number {
  const numericValue = typeof value === 'number' ? value : NaN;
  const { formatted } = useCountUp(Number.isFinite(numericValue) ? numericValue : 0, {
    durationMs: 1100,
  });

  if (typeof value === 'number' && Number.isFinite(value)) return formatted;

  if (typeof value === 'string') {
    const match = value.match(/^(\d[\d.,]*)\s*(.*)$/);
    if (match) {
      const num = Number(match[1].replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(num)) {
        return `${formatted}${match[2] ? ' ' + match[2] : ''}`;
      }
    }
  }
  return value;
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
  const tokens = COLOR_TOKENS[color];
  const display = useAnimatedValue(value);

  return (
    <div
      className={[
        'surface-elevated hover-lift relative flex flex-col',
        large ? 'p-8 rounded-3xl' : 'p-6 rounded-2xl',
        'animate-fade-in-up',
      ].join(' ')}
      style={{ animationDelay: `${delay * 60}ms` }}
    >
      {/* Header: label + ícone */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <p
          className={`text-[11px] font-medium uppercase tracking-wider-2 text-[var(--text-tertiary)] leading-tight pt-1`}
        >
          {title}
        </p>
        <div
          className={`inline-flex items-center justify-center ${large ? 'w-10 h-10 rounded-xl' : 'w-8 h-8 rounded-lg'} ${tokens.iconBg} ${tokens.iconText} shrink-0`}
        >
          {icon}
        </div>
      </div>

      {/* Número escultural */}
      {loading ? (
        <div
          className={`${large ? 'h-14 w-40' : 'h-12 w-32'} shimmer rounded-md`}
          aria-hidden
        />
      ) : (
        <div className="flex items-baseline gap-2">
          <p
            className={[
              large ? 'text-[64px]' : 'text-[44px]',
              'font-semibold tracking-tightest leading-none tnum text-[var(--text-primary)]',
            ].join(' ')}
            style={{ fontVariationSettings: '"opsz" 32' }}
          >
            {display}
          </p>
          {delta !== null && delta !== undefined && Number.isFinite(delta) && (
            <DeltaPill delta={delta} positiveIsGood={positiveIsGood} />
          )}
        </div>
      )}

      {/* Subtitle / descrição */}
      {(subtitleNode || subtitle) && (
        <div className={`mt-3 ${large ? 'text-sm' : 'text-[13px]'} text-[var(--text-secondary)] leading-snug`}>
          {subtitleNode ? subtitleNode : subtitle}
        </div>
      )}

      {/* Breakdown (chips no rodapé) */}
      {breakdown && (
        <div className="mt-auto pt-5">
          <div className="flex flex-wrap gap-1.5">{breakdown}</div>
        </div>
      )}
    </div>
  );
}
