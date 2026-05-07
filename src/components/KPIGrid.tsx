import {
  AlarmClock,
  CheckCircle,
  Clock,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { KPICard } from './KPICard';
import { MetricsDelta, TicketMetrics } from '../services/analytics';
import { formatHoursMinutes } from '../utils/timeFormat';

interface KPIGridProps {
  metrics: TicketMetrics;
  delta: MetricsDelta;
  loadingHours: boolean;
  large?: boolean;
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
      ? 'Horas acima do planejado'
      : 'Horas economizadas';

  const staleSubtitle =
    metrics.open === 0
      ? 'Nenhum chamado em aberto'
      : `Em média ${metrics.avgDaysOpen.toFixed(1)}d em aberto`;

  const iconClass = large ? 'w-8 h-8' : 'w-6 h-6';
  const hasComparison = delta.previous !== null;

  return (
    <div className="space-y-3">
    {hasComparison && !large && (
      <div className="flex items-center gap-2 text-xs text-minerva-navy/60 dark:text-white/60">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
        <span>
          As variações em <strong>%</strong> nos cards comparam o período atual com o período
          anterior de mesma duração.
        </span>
      </div>
    )}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4 md:gap-6">
      <KPICard
        title="Total de Chamados"
        value={metrics.total}
        subtitle={`${metrics.inProgress} em atendimento`}
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
        subtitle={`${metrics.finalized} finalizados`}
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
        subtitle={`${metrics.pending} pendentes · ${metrics.newTickets} novos`}
        icon={<Users className={iconClass} aria-hidden />}
        color="amber"
        delay={2}
        large={large}
        delta={delta.deltas.open}
        positiveIsGood={false}
      />
      <KPICard
        title="Chamados Parados"
        value={metrics.staleCount}
        subtitle={
          metrics.staleCount === 0
            ? `Nenhum parado há mais de ${metrics.staleThresholdDays}d`
            : `${staleSubtitle} · limite ${metrics.staleThresholdDays}d`
        }
        icon={<AlarmClock className={iconClass} aria-hidden />}
        color={metrics.staleCount > 0 ? 'red' : 'green'}
        delay={3}
        large={large}
        delta={delta.deltas.staleCount}
        positiveIsGood={false}
      />
      <KPICard
        title="Média de Horas"
        value={loadingHours ? '...' : formatHoursMinutes(metrics.avgWorkHours)}
        subtitle={
          loadingHours ? 'Calculando...' : `${formatHoursMinutes(metrics.totalRealizedHours)} realizadas`
        }
        icon={<Clock className={iconClass} aria-hidden />}
        color="violet"
        delay={4}
        large={large}
        loading={loadingHours}
        delta={delta.deltas.avgWorkHours}
        positiveIsGood={false}
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
