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
    <ul className="space-y-1 text-white" aria-label="Quebra dos chamados em aberto">
      <li className="flex items-baseline gap-2 leading-snug">
        <span className="font-semibold tabular-nums shrink-0">{inProgress}</span>
        <span className="text-sm shrink-0">Em atendimento</span>
        <span className="text-[11px] text-white/75">na nossa mão</span>
      </li>
      <li className="flex items-baseline gap-2 leading-snug">
        <span className="font-semibold tabular-nums shrink-0">{pending}</span>
        <span className="text-sm shrink-0">Pendentes</span>
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
        <span className="text-sm shrink-0">Novos</span>
        <span className="text-[11px] text-white/75">ainda não atribuídos</span>
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
    return <p className="text-sm text-white/80">Sem chamados no período</p>;
  }
  const incPct = (incident / total) * 100;
  const reqPct = (request / total) * 100;
  const unkPct = (unknown / total) * 100;
  const headline =
    dominant === 'incident'
      ? 'Incidentes dominam — operação reativa'
      : dominant === 'request'
        ? 'Requisições dominam — projetos e melhorias'
        : 'Demanda balanceada entre incidente e requisição';
  return (
    <div className="space-y-2">
      <p className="text-xs text-white/85 leading-snug">{headline}</p>
      <div
        className="h-2 w-full rounded-full bg-white/15 overflow-hidden flex"
        role="img"
        aria-label={`Distribuição: ${incident} incidente${incident === 1 ? '' : 's'}, ${request} requisição${request === 1 ? '' : 'ões'}${unknown ? `, ${unknown} sem tipo` : ''}`}
      >
        {incPct > 0 && (
          <div
            className="h-full bg-rose-300"
            style={{ width: `${incPct}%` }}
            title={`${incident} incidente${incident === 1 ? '' : 's'}`}
          />
        )}
        {reqPct > 0 && (
          <div
            className="h-full bg-sky-300"
            style={{ width: `${reqPct}%` }}
            title={`${request} requisição${request === 1 ? '' : 'ões'}`}
          />
        )}
        {unkPct > 0 && (
          <div
            className="h-full bg-white/40"
            style={{ width: `${unkPct}%` }}
            title={`${unknown} sem tipo`}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/85">
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-300" aria-hidden />
          <span className="font-semibold tabular-nums">{incident}</span>{' '}
          incidente{incident === 1 ? '' : 's'}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-300" aria-hidden />
          <span className="font-semibold tabular-nums">{request}</span>{' '}
          requisi{request === 1 ? 'ção' : 'ções'}
        </span>
        {unknown > 0 && (
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white/40" aria-hidden />
            <span className="font-semibold tabular-nums">{unknown}</span> sem tipo
          </span>
        )}
      </div>
    </div>
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

  const iconClass = large ? 'w-8 h-8' : 'w-6 h-6';
  const hasComparison = delta.previous !== null;

  // Mix do período (Incidente vs Requisição)
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
    <div className="space-y-3">
      {hasComparison && !large && (
        <div className="flex items-center gap-2 text-xs text-minerva-navy/70 dark:text-white/70">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
          <span>
            Variações em <strong>%</strong> aparecem apenas em KPIs onde a comparação faz sentido
            (Total e Taxa de Resolução). KPIs de snapshot — em aberto, médias, saldo e mix do
            período — mostram apenas o número atual.
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
          value={loadingHours ? '...' : formatHoursMinutes(metrics.avgWorkHours)}
          subtitle={
            loadingHours
              ? 'Calculando...'
              : `${formatHoursMinutes(metrics.totalRealizedHours)} realizadas no total`
          }
          icon={<Clock className={iconClass} aria-hidden />}
          color="violet"
          delay={3}
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
    </div>
  );
}
