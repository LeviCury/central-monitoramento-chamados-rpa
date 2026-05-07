import {
  AlarmClock,
  CheckCircle,
  Clock,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { KPICard } from './KPICard';
import { MetricsDelta, TicketMetrics, TypeBreakdown } from '../services/analytics';
import { formatHoursMinutes } from '../utils/timeFormat';

interface KPIGridProps {
  metrics: TicketMetrics;
  delta: MetricsDelta;
  loadingHours: boolean;
  large?: boolean;
}

/**
 * Mini-pílulas Incidente / Requisição mostradas no rodapé dos cards.
 * Usa o nome completo (não abreviado) para ficar legível em qualquer
 * largura — KPIs agora ocupam 1/3 da largura mínima útil, então sobra
 * espaço.
 */
function TypePills({ breakdown }: { breakdown: TypeBreakdown }) {
  const total = breakdown.incident + breakdown.request + breakdown.unknown;
  if (total === 0) return null;
  return (
    <>
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-medium text-white"
        title={`${breakdown.incident} incidente${breakdown.incident === 1 ? '' : 's'}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-300" aria-hidden />
        Incidente {breakdown.incident}
      </span>
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-medium text-white"
        title={`${breakdown.request} requisiç${breakdown.request === 1 ? 'ão' : 'ões'}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-sky-300" aria-hidden />
        Requisição {breakdown.request}
      </span>
      {breakdown.unknown > 0 && (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-medium text-white/80"
          title={`${breakdown.unknown} sem tipo definido no GLPI`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/50" aria-hidden />
          Sem tipo {breakdown.unknown}
        </span>
      )}
    </>
  );
}

const PENDING_TOOLTIP =
  'Pendente = aguardando algo externo à equipe (cliente, fornecedor ou outro time). O chamado não está mais na nossa mão.';

interface OpenSubtitleProps {
  inProgress: number;
  pending: number;
  newTickets: number;
}

function OpenSubtitle({ inProgress, pending, newTickets }: OpenSubtitleProps) {
  return (
    <ul className="space-y-1.5 text-white" aria-label="Quebra dos chamados em aberto">
      <li className="flex items-baseline gap-2 leading-snug">
        <span className="font-semibold tabular-nums shrink-0">{inProgress}</span>
        <span className="text-sm shrink-0">em atendimento</span>
        <span className="text-[11px] text-white/75">na nossa mão</span>
      </li>
      <li className="flex items-baseline gap-2 leading-snug">
        <span className="font-semibold tabular-nums shrink-0">{pending}</span>
        <span className="text-sm shrink-0">pendentes</span>
        <span
          className="inline-flex items-center gap-1 text-[11px] text-white/75"
          title={PENDING_TOOLTIP}
        >
          aguardando externos
          <HelpCircle className="w-3 h-3" aria-label={PENDING_TOOLTIP} />
        </span>
      </li>
      <li className="flex items-baseline gap-2 leading-snug">
        <span className="font-semibold tabular-nums shrink-0">{newTickets}</span>
        <span className="text-sm shrink-0">novos</span>
        <span className="text-[11px] text-white/75">não atribuídos</span>
      </li>
    </ul>
  );
}

export function KPIGrid({ metrics, delta, loadingHours, large = false }: KPIGridProps) {
  const balanceIsLoss = metrics.hoursBalanceType === 'loss';
  const balanceIsNeutral = metrics.hoursBalanceType === 'neutral';
  const balanceTitle = balanceIsNeutral
    ? 'Saldo de Horas'
    : balanceIsLoss
      ? 'Perda de Horas'
      : 'Ganho de Horas';
  const balanceSubtitle = balanceIsNeutral
    ? 'Realizado igual ao planejado'
    : balanceIsLoss
      ? 'Horas realizadas acima do planejado'
      : 'Horas economizadas vs planejado';

  const staleSubtitle =
    metrics.staleCount === 0
      ? `Nenhum chamado parado há mais de ${metrics.staleThresholdDays} dias`
      : `Média ${metrics.avgDaysOpen.toFixed(1)}d em aberto · limite ${metrics.staleThresholdDays}d`;

  const iconClass = large ? 'w-8 h-8' : 'w-6 h-6';
  const hasComparison = delta.previous !== null;

  return (
    <div className="space-y-3">
      {hasComparison && !large && (
        <div className="flex items-center gap-2 text-xs text-minerva-navy/70 dark:text-white/70">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
          <span>
            Variações em <strong>%</strong> aparecem apenas em KPIs onde a comparação faz sentido
            (Total e Taxa de Resolução). KPIs de snapshot — em aberto, parados, médias — mostram
            apenas o número atual.
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <KPICard
          title="Total de Chamados"
          value={metrics.total}
          subtitle={`${metrics.inProgress} em atendimento agora`}
          breakdown={<TypePills breakdown={metrics.totalByType} />}
          icon={<TrendingUp className={iconClass} aria-hidden />}
          color="navy"
          delay={0}
          large={large}
          delta={delta.deltas.total}
          positiveIsGood={false}
        />
        <KPICard
          title="Taxa de Resolução"
          value={`${metrics.closureRate}%`}
          subtitle={`${metrics.finalized} finalizados de ${metrics.total}`}
          icon={<CheckCircle className={iconClass} aria-hidden />}
          color="green"
          delay={1}
          large={large}
          delta={delta.deltas.closureRate}
          positiveIsGood
        />
        <KPICard
          title="Chamados em Aberto"
          value={metrics.open}
          subtitleNode={
            <OpenSubtitle
              inProgress={metrics.inProgress}
              pending={metrics.pending}
              newTickets={metrics.newTickets}
            />
          }
          breakdown={<TypePills breakdown={metrics.openByType} />}
          icon={<Users className={iconClass} aria-hidden />}
          color="amber"
          delay={2}
          large={large}
        />
        <KPICard
          title="Chamados Parados"
          value={metrics.staleCount}
          subtitle={staleSubtitle}
          breakdown={metrics.staleCount > 0 ? <TypePills breakdown={metrics.staleByType} /> : undefined}
          icon={<AlarmClock className={iconClass} aria-hidden />}
          color={metrics.staleCount > 0 ? 'red' : 'green'}
          delay={3}
          large={large}
        />
        <KPICard
          title="Média de Horas"
          value={loadingHours ? '...' : formatHoursMinutes(metrics.avgWorkHours)}
          subtitle={
            loadingHours
              ? 'Calculando...'
              : `${formatHoursMinutes(metrics.totalRealizedHours)} realizadas no total`
          }
          icon={<Clock className={iconClass} aria-hidden />}
          color="violet"
          delay={4}
          large={large}
          loading={loadingHours}
        />
        <KPICard
          title={balanceTitle}
          value={loadingHours ? '...' : formatHoursMinutes(Math.abs(metrics.hoursBalance))}
          subtitle={loadingHours ? 'Calculando...' : balanceSubtitle}
          icon={
            balanceIsLoss
              ? <TrendingDown className={iconClass} aria-hidden />
              : <TrendingUp className={iconClass} aria-hidden />
          }
          color={balanceIsLoss ? 'red' : balanceIsNeutral ? 'navy' : 'green'}
          delay={5}
          large={large}
          loading={loadingHours}
        />
      </div>
    </div>
  );
}
