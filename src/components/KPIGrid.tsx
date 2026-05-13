import {
  CheckCircle,
  Clock,
  HelpCircle,
  PieChart,
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
  hoursSkipped?: boolean;
  hoursMaxLimit?: number;
  large?: boolean;
}

/**
 * Mini-pílulas de breakdown — neutras e discretas (Apple-style).
 */
function TypePills({ breakdown }: { breakdown: TypeBreakdown }) {
  const total = breakdown.incident + breakdown.request + breakdown.unknown;
  if (total === 0) return null;
  return (
    <>
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--bg-subtle)]"
        title={`${breakdown.incident} incidente${breakdown.incident === 1 ? '' : 's'}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden />
        <span className="tnum text-[var(--text-primary)] font-semibold">
          {breakdown.incident}
        </span>{' '}
        incidente
      </span>
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--bg-subtle)]"
        title={`${breakdown.request} requisiç${breakdown.request === 1 ? 'ão' : 'ões'}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" aria-hidden />
        <span className="tnum text-[var(--text-primary)] font-semibold">
          {breakdown.request}
        </span>{' '}
        requisição
      </span>
      {breakdown.unknown > 0 && (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--bg-subtle)]"
          title={`${breakdown.unknown} sem tipo definido`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]" aria-hidden />
          <span className="tnum text-[var(--text-primary)] font-semibold">
            {breakdown.unknown}
          </span>{' '}
          sem tipo
        </span>
      )}
    </>
  );
}

const PENDING_TOOLTIP =
  'Pendente = aguardando algo externo à equipe (cliente, fornecedor ou outro time).';

interface OpenSubtitleProps {
  inProgress: number;
  pending: number;
  newTickets: number;
}

function OpenSubtitle({ inProgress, pending, newTickets }: OpenSubtitleProps) {
  return (
    <ul className="space-y-1" aria-label="Quebra dos chamados em aberto">
      <li className="flex items-baseline gap-2">
        <span className="tnum font-semibold text-[var(--text-primary)] w-6 text-right shrink-0">
          {inProgress}
        </span>
        <span className="text-[var(--text-secondary)]">Em atendimento</span>
      </li>
      <li className="flex items-baseline gap-2">
        <span className="tnum font-semibold text-[var(--text-primary)] w-6 text-right shrink-0">
          {pending}
        </span>
        <span className="text-[var(--text-secondary)] inline-flex items-center gap-1">
          Pendentes
          <HelpCircle className="w-3 h-3 text-[var(--text-tertiary)]" aria-label={PENDING_TOOLTIP} />
        </span>
      </li>
      <li className="flex items-baseline gap-2">
        <span className="tnum font-semibold text-[var(--text-primary)] w-6 text-right shrink-0">
          {newTickets}
        </span>
        <span className="text-[var(--text-secondary)]">Novos</span>
      </li>
    </ul>
  );
}

type MixDominant = 'incident' | 'request' | 'balanced' | 'empty';

interface MixSubtitleProps {
  incident: number;
  request: number;
  unknown: number;
  dominant: MixDominant;
}

function MixSubtitle({ incident, request, unknown, dominant }: MixSubtitleProps) {
  const total = incident + request + unknown;
  if (total === 0) {
    return <p className="text-[var(--text-tertiary)]">Sem chamados no período</p>;
  }
  const incPct = (incident / total) * 100;
  const reqPct = (request / total) * 100;
  const unkPct = (unknown / total) * 100;
  const headline =
    dominant === 'incident'
      ? 'Operação reativa'
      : dominant === 'request'
        ? 'Projetos & melhorias'
        : 'Demanda balanceada';

  return (
    <div className="space-y-2.5">
      <p className="text-[var(--text-secondary)]">{headline}</p>
      <div
        className="h-1.5 w-full rounded-full bg-[var(--bg-subtle)] overflow-hidden flex"
        role="img"
        aria-label={`${incident} incidente${incident === 1 ? '' : 's'}, ${request} requisição${request === 1 ? '' : 'ões'}`}
      >
        {incPct > 0 && (
          <div
            className="h-full bg-rose-500 transition-[width] duration-700 ease-out"
            style={{ width: `${incPct}%` }}
          />
        )}
        {reqPct > 0 && (
          <div
            className="h-full bg-sky-500 transition-[width] duration-700 ease-out"
            style={{ width: `${reqPct}%` }}
          />
        )}
        {unkPct > 0 && (
          <div
            className="h-full bg-[var(--text-tertiary)] transition-[width] duration-700 ease-out"
            style={{ width: `${unkPct}%` }}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)]">
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden />
          <span className="tnum font-semibold text-[var(--text-primary)]">{incident}</span> incidente{incident === 1 ? '' : 's'}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" aria-hidden />
          <span className="tnum font-semibold text-[var(--text-primary)]">{request}</span> requisi{request === 1 ? 'ção' : 'ções'}
        </span>
      </div>
    </div>
  );
}

export function KPIGrid({
  metrics,
  delta,
  loadingHours,
  hoursSkipped = false,
  hoursMaxLimit,
  large = false,
}: KPIGridProps) {
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
      ? 'Realizado acima do planejado'
      : 'Horas economizadas vs planejado';

  const iconClass = large ? 'w-5 h-5' : 'w-4 h-4';

  const mix = metrics.totalByType;
  const mixTotal = mix.incident + mix.request + mix.unknown;
  const mixIncPct = mixTotal > 0 ? (mix.incident / mixTotal) * 100 : 0;
  const mixReqPct = mixTotal > 0 ? (mix.request / mixTotal) * 100 : 0;
  const mixDiff = Math.abs(mixIncPct - mixReqPct);
  const mixDominant: MixDominant =
    mixTotal === 0
      ? 'empty'
      : mixDiff < 10
        ? 'balanced'
        : mixIncPct > mixReqPct
          ? 'incident'
          : 'request';
  const mixValue =
    mixDominant === 'empty'
      ? '—'
      : mixDominant === 'balanced'
        ? '~50%'
        : `${Math.round(Math.max(mixIncPct, mixReqPct))}%`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        value={`${metrics.finalized} de ${metrics.total}`}
        subtitle={`${metrics.closureRate}% finalizados no período`}
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
        title="Média de Horas"
        value={
          hoursSkipped
            ? '—'
            : loadingHours
              ? '...'
              : formatHoursMinutes(metrics.avgWorkHours)
        }
        subtitle={
          hoursSkipped
            ? `Recorte com mais de ${hoursMaxLimit ?? '?'} chamados — reduza o período`
            : loadingHours
              ? 'Calculando…'
              : `${formatHoursMinutes(metrics.totalRealizedHours)} realizadas no total`
        }
        icon={<Clock className={iconClass} aria-hidden />}
        color="violet"
        delay={3}
        large={large}
        loading={loadingHours}
      />
      <KPICard
        title={hoursSkipped ? 'Saldo de Horas' : balanceTitle}
        value={
          hoursSkipped
            ? '—'
            : loadingHours
              ? '...'
              : formatHoursMinutes(Math.abs(metrics.hoursBalance))
        }
        subtitle={
          hoursSkipped
            ? `Apontamentos não buscados (${hoursMaxLimit ?? '?'} chamados é o teto)`
            : loadingHours
              ? 'Calculando…'
              : balanceSubtitle
        }
        icon={
          balanceIsLoss
            ? <TrendingDown className={iconClass} aria-hidden />
            : <TrendingUp className={iconClass} aria-hidden />
        }
        color={
          hoursSkipped
            ? 'navy'
            : balanceIsLoss
              ? 'red'
              : balanceIsNeutral
                ? 'navy'
                : 'green'
        }
        delay={4}
        large={large}
        loading={loadingHours}
      />
      <KPICard
        title="Mix do Período"
        value={mixValue}
        subtitleNode={
          <MixSubtitle
            incident={mix.incident}
            request={mix.request}
            unknown={mix.unknown}
            dominant={mixDominant}
          />
        }
        icon={<PieChart className={iconClass} aria-hidden />}
        color="navy"
        delay={5}
        large={large}
      />
    </div>
  );
}
