import {
  CollaboratorHours,
  Ticket,
  TicketHoursStatus,
  TicketTaskEntry,
  TicketType,
} from '../types';
import { config, isGLPIConfigured } from '../config';
import {
  fetchTicketsFromGLPI,
  fetchMultipleTicketTaskEntries,
} from './glpi';
import { formatHoursMinutes } from '../utils/timeFormat';

// ======================================================
// Fetching
// ======================================================

export interface FetchTicketsParams {
  startDate?: string;
  endDate?: string;
  statuses?: string[];
  priorities?: string[];
  technicians?: string[];
  groupId?: string;
  signal?: AbortSignal;
}

export const fetchTickets = async (params: FetchTicketsParams): Promise<Ticket[]> => {
  if (!isGLPIConfigured()) {
    console.warn('API GLPI não configurada. Configure as variáveis de ambiente.');
    return [];
  }

  const effectiveGroupId = params.groupId || config.glpi.defaultGroupId;
  const effectiveEntityId = config.glpi.entityId ?? undefined;
  if (config.isDev) {
    console.info(
      `[GLPI] Buscando chamados — grupo=${effectiveGroupId}` +
        (effectiveEntityId ? `, entidade=${effectiveEntityId}` : ' (sem filtro de entidade)') +
        (params.startDate ? ` · de ${params.startDate}` : '') +
        (params.endDate ? ` até ${params.endDate}` : '')
    );
  }

  const tickets = await fetchTicketsFromGLPI({
    startDate: params.startDate,
    endDate: params.endDate,
    statuses: params.statuses,
    priorities: params.priorities,
    groupId: effectiveGroupId,
    entityId: effectiveEntityId,
    signal: params.signal,
  });

  let filtered = tickets;
  if (params.technicians && params.technicians.length > 0) {
    filtered = tickets.filter(t => params.technicians!.includes(t.assigned_technician));
  }

  return filtered.sort(
    (a, b) => new Date(b.opened_date).getTime() - new Date(a.opened_date).getTime()
  );
};

export const fetchWorkHoursForTickets = async (tickets: Ticket[]): Promise<Ticket[]> => {
  if (tickets.length === 0) return tickets;

  const ticketIds = tickets.map(t => t.id);
  const tasksCache = await fetchMultipleTicketTaskEntries(ticketIds);
  const firstStructuredTaskDate = getFirstStructuredTaskDate(tickets, tasksCache);

  for (const ticket of tickets) {
    const taskEntries = tasksCache.get(ticket.id) ?? [];
    applyTaskBreakdownToTicket(ticket, taskEntries, firstStructuredTaskDate);
  }

  return tickets;
};

// ======================================================
// Helpers internos
// ======================================================

function roundHours(value: number): number {
  return Math.round(value * 10) / 10;
}

function getTicketDate(ticket: Ticket): number {
  return new Date(ticket.opened_date || ticket.created_at || ticket.updated_date).getTime();
}

function getFirstStructuredTaskDate(
  tickets: Ticket[],
  tasksCache: Map<string, TicketTaskEntry[]>
): number | null {
  let firstDate: number | null = null;
  for (const ticket of tickets) {
    const entries = tasksCache.get(ticket.id) ?? [];
    const hasStructuredEntry = entries.some(e => e.kind === 'planned' || e.kind === 'realized');
    if (!hasStructuredEntry) continue;

    const ticketDate = getTicketDate(ticket);
    if (Number.isNaN(ticketDate)) continue;
    firstDate = firstDate === null ? ticketDate : Math.min(firstDate, ticketDate);
  }
  return firstDate;
}

function getHoursStatus(
  ticket: Ticket,
  plannedHours: number,
  realizedHours: number,
  legacyHours: number,
  firstStructuredTaskDate: number | null
): TicketHoursStatus {
  const hasPlanned = plannedHours > 0;
  const hasRealized = realizedHours > 0;

  if (hasPlanned && hasRealized) return 'complete';
  if (hasPlanned && !hasRealized) return 'missing_realized';
  if (!hasPlanned && hasRealized) return 'missing_planned';

  const ticketDate = getTicketDate(ticket);
  const isCurrentTicket =
    firstStructuredTaskDate !== null &&
    !Number.isNaN(ticketDate) &&
    ticketDate >= firstStructuredTaskDate;

  if (legacyHours > 0 && !isCurrentTicket) return 'legacy';
  if (isCurrentTicket) return 'missing_both';
  if (legacyHours > 0) return 'legacy';
  return 'no_rpa_tasks';
}

function aggregateCollaboratorHours(taskEntries: TicketTaskEntry[]): CollaboratorHours[] {
  const grouped = new Map<string, CollaboratorHours>();
  for (const entry of taskEntries) {
    const current = grouped.get(entry.collaborator) ?? {
      collaborator: entry.collaborator,
      planned_hours: 0,
      realized_hours: 0,
      legacy_hours: 0,
      tasks: [],
    };

    if (entry.kind === 'planned') current.planned_hours += entry.hours;
    else if (entry.kind === 'realized') current.realized_hours += entry.hours;
    else current.legacy_hours += entry.hours;

    current.tasks.push(entry);
    grouped.set(entry.collaborator, current);
  }

  return Array.from(grouped.values())
    .map(item => ({
      ...item,
      planned_hours: roundHours(item.planned_hours),
      realized_hours: roundHours(item.realized_hours),
      legacy_hours: roundHours(item.legacy_hours),
    }))
    .sort((a, b) => a.collaborator.localeCompare(b.collaborator));
}

function applyTaskBreakdownToTicket(
  ticket: Ticket,
  taskEntries: TicketTaskEntry[],
  firstStructuredTaskDate: number | null
): void {
  const sumByKind = (kind: TicketTaskEntry['kind']) =>
    roundHours(taskEntries.filter(e => e.kind === kind).reduce((s, e) => s + e.hours, 0));

  const planned = sumByKind('planned');
  const realized = sumByKind('realized');
  const legacy = sumByKind('legacy');
  const totalFromTasks = realized + legacy;

  // PRIORIDADE: o agregado oficial vem do ticket (campo 49 = actiontime),
  // ja populado em parseGLPITicket. So sobrescrevemos com o detalhamento
  // por colaborador/categoria SE ele encontrar algo (totalFromTasks > 0).
  // Caso contrario (filtro de whitelist vazio, categoria desconhecida etc.)
  // preservamos o numero do GLPI para o card nao mentir 0h.
  ticket.task_entries = taskEntries;
  ticket.collaborator_hours = aggregateCollaboratorHours(taskEntries);

  if (totalFromTasks > 0) {
    ticket.planned_time_hours = planned;
    ticket.realized_time_hours = realized;
    ticket.legacy_time_hours = legacy;
    ticket.resolution_time_hours = roundHours(totalFromTasks);
    ticket.hours_status = getHoursStatus(
      ticket,
      planned,
      realized,
      legacy,
      firstStructuredTaskDate
    );
  } else if ((ticket.realized_time_hours || 0) > 0) {
    // Tem actiontime no ticket mas nada bateu nos filtros das tasks:
    // mantemos as horas oficiais como "legacy" para indicar que nao
    // ha breakdown por colaborador / categoria.
    ticket.legacy_time_hours = ticket.realized_time_hours || 0;
    ticket.realized_time_hours = 0;
    ticket.resolution_time_hours = ticket.legacy_time_hours;
    ticket.hours_status = 'legacy';
  } else {
    // Nem o ticket nem as tasks tem horas: zeramos tudo limpo.
    ticket.planned_time_hours = 0;
    ticket.realized_time_hours = 0;
    ticket.legacy_time_hours = 0;
    ticket.resolution_time_hours = null;
    ticket.hours_status = getHoursStatus(ticket, 0, 0, 0, firstStructuredTaskDate);
  }
}

// ======================================================
// Tempo em aberto / "Chamados parados"
// ======================================================

const OPEN_STATUSES = new Set([
  'Novo',
  'Em Atendimento (atribuído)',
  'Em Atendimento (planejado)',
  'Pendente',
]);

export interface StaleInfo {
  /** Quantos dias o chamado está em aberto (ou ficou aberto, se já fechado). */
  daysOpen: number;
  /** É um chamado em aberto há mais de `thresholdDays`? */
  isStale: boolean;
  /** O ticket está atualmente em aberto? */
  isOpen: boolean;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function getStaleInfo(
  ticket: Ticket,
  thresholdDays: number = config.ui.staleThresholdDays
): StaleInfo {
  const opened = new Date(ticket.opened_date || ticket.created_at).getTime();
  const isOpen = OPEN_STATUSES.has(ticket.status);
  const referenceDate = isOpen
    ? Date.now()
    : new Date(
        ticket.resolved_date || ticket.updated_date || ticket.opened_date
      ).getTime();

  const elapsedMs = Math.max(0, referenceDate - opened);
  const daysOpen = elapsedMs / MS_PER_DAY;

  return {
    daysOpen,
    isOpen,
    isStale: isOpen && daysOpen > thresholdDays,
  };
}

// ======================================================
// Métricas principais
// ======================================================

/** Breakdown { incidente, requisição, sem tipo (unknown) } para um indicador qualquer. */
export interface TypeBreakdown {
  incident: number;
  request: number;
  unknown: number;
}

export interface TicketMetrics {
  total: number;
  closed: number;
  solved: number;
  inProgress: number;
  pending: number;
  newTickets: number;
  open: number;
  finalized: number;
  closureRate: number;
  avgWorkHours: number;
  totalWorkHours: number;
  totalPlannedHours: number;
  totalRealizedHours: number;
  totalLegacyHours: number;
  hoursBalance: number;
  hoursBalanceType: 'gain' | 'loss' | 'neutral';
  pendingHoursNotes: number;
  /** Quantidade de chamados em aberto há mais de `staleThresholdDays`. */
  staleCount: number;
  /** Limite (em dias) usado para classificar um chamado como "parado". */
  staleThresholdDays: number;
  /** Média (em dias) que os chamados em aberto estão abertos. */
  avgDaysOpen: number;
  // ---- Breakdowns por tipo (Incidente vs Requisição) ----
  totalByType: TypeBreakdown;
  inProgressByType: TypeBreakdown;
  pendingByType: TypeBreakdown;
  newByType: TypeBreakdown;
  staleByType: TypeBreakdown;
  finalizedByType: TypeBreakdown;
  openByType: TypeBreakdown;
}

const emptyTypeBreakdown = (): TypeBreakdown => ({ incident: 0, request: 0, unknown: 0 });

const incrementTypeBreakdown = (acc: TypeBreakdown, type: TicketType): void => {
  acc[type] += 1;
};

export const getTicketMetrics = (
  tickets: Ticket[],
  staleThresholdDays: number = config.ui.staleThresholdDays
): TicketMetrics => {
  let total = 0;
  let closed = 0;
  let solved = 0;
  let inProgress = 0;
  let pending = 0;
  let newTickets = 0;
  let totalPlannedHours = 0;
  let totalRealizedHours = 0;
  let totalLegacyHours = 0;
  let pendingHoursNotes = 0;
  let ticketsWithHoursCount = 0;
  let staleCount = 0;
  let openDaysSum = 0;
  let openCount = 0;

  const totalByType = emptyTypeBreakdown();
  const inProgressByType = emptyTypeBreakdown();
  const pendingByType = emptyTypeBreakdown();
  const newByType = emptyTypeBreakdown();
  const staleByType = emptyTypeBreakdown();
  const finalizedByType = emptyTypeBreakdown();
  const openByType = emptyTypeBreakdown();

  for (const t of tickets) {
    total++;
    incrementTypeBreakdown(totalByType, t.type);

    const statusLower = t.status.toLowerCase();
    let bucket: 'closed' | 'solved' | 'inProgress' | 'pending' | 'new' | null = null;
    if (statusLower.includes('fechado')) {
      closed++;
      bucket = 'closed';
    } else if (statusLower.includes('solucionado')) {
      solved++;
      bucket = 'solved';
    } else if (statusLower.includes('atendimento')) {
      inProgress++;
      bucket = 'inProgress';
      incrementTypeBreakdown(inProgressByType, t.type);
    } else if (statusLower.includes('pendente')) {
      pending++;
      bucket = 'pending';
      incrementTypeBreakdown(pendingByType, t.type);
    } else if (statusLower === 'novo') {
      newTickets++;
      bucket = 'new';
      incrementTypeBreakdown(newByType, t.type);
    }

    if (bucket === 'closed' || bucket === 'solved') {
      incrementTypeBreakdown(finalizedByType, t.type);
    } else if (bucket === 'inProgress' || bucket === 'pending' || bucket === 'new') {
      incrementTypeBreakdown(openByType, t.type);
    }

    const planned = t.planned_time_hours || 0;
    const realized = t.realized_time_hours || 0;
    const legacy = t.legacy_time_hours || 0;
    totalPlannedHours += planned;
    totalRealizedHours += realized;
    totalLegacyHours += legacy;
    if (realized > 0 || legacy > 0) ticketsWithHoursCount++;

    if (
      t.hours_status === 'missing_planned' ||
      t.hours_status === 'missing_realized' ||
      t.hours_status === 'missing_both'
    ) {
      pendingHoursNotes++;
    }

    const stale = getStaleInfo(t, staleThresholdDays);
    if (stale.isOpen) {
      openCount++;
      openDaysSum += stale.daysOpen;
      if (stale.isStale) {
        staleCount++;
        incrementTypeBreakdown(staleByType, t.type);
      }
    }
  }

  const totalHours = totalRealizedHours + totalLegacyHours;
  const hoursBalance = totalPlannedHours - totalRealizedHours;
  const hoursBalanceType: TicketMetrics['hoursBalanceType'] =
    hoursBalance > 0 ? 'gain' : hoursBalance < 0 ? 'loss' : 'neutral';

  const avgWorkHours = ticketsWithHoursCount > 0 ? totalHours / ticketsWithHoursCount : 0;
  const closureRate = total > 0 ? ((closed + solved) / total) * 100 : 0;
  const avgDaysOpen = openCount > 0 ? openDaysSum / openCount : 0;

  return {
    total,
    closed,
    solved,
    inProgress,
    pending,
    newTickets,
    open: inProgress + pending + newTickets,
    finalized: closed + solved,
    closureRate: Math.round(closureRate * 10) / 10,
    avgWorkHours: Math.round(avgWorkHours * 10) / 10,
    totalWorkHours: Math.round(totalHours * 10) / 10,
    totalPlannedHours: Math.round(totalPlannedHours * 10) / 10,
    totalRealizedHours: Math.round(totalRealizedHours * 10) / 10,
    totalLegacyHours: Math.round(totalLegacyHours * 10) / 10,
    hoursBalance: Math.round(hoursBalance * 10) / 10,
    hoursBalanceType,
    pendingHoursNotes,
    staleCount,
    staleThresholdDays,
    avgDaysOpen: Math.round(avgDaysOpen * 10) / 10,
    totalByType,
    inProgressByType,
    pendingByType,
    newByType,
    staleByType,
    finalizedByType,
    openByType,
  };
};

// ======================================================
// Agregações
// ======================================================

export const aggregateTicketsByStatus = (tickets: Ticket[]) => {
  const map = new Map<string, number>();
  for (const t of tickets) map.set(t.status, (map.get(t.status) ?? 0) + 1);
  return Array.from(map.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
};

export const TYPE_LABEL: Record<TicketType, string> = {
  incident: 'Incidente',
  request: 'Requisição',
  unknown: 'Sem tipo',
};

export interface TypeAggregate {
  type: TicketType;
  label: string;
  count: number;
}

/**
 * Conta chamados por tipo (Incidente / Requisição / Sem tipo).
 * Retorna em ordem decrescente, omitindo a fatia "unknown" quando vier vazia.
 */
export const aggregateTicketsByType = (tickets: Ticket[]): TypeAggregate[] => {
  const counts: TypeBreakdown = emptyTypeBreakdown();
  for (const t of tickets) incrementTypeBreakdown(counts, t.type);

  const entries: TypeAggregate[] = [
    { type: 'incident', label: TYPE_LABEL.incident, count: counts.incident },
    { type: 'request', label: TYPE_LABEL.request, count: counts.request },
  ];
  if (counts.unknown > 0) {
    entries.push({ type: 'unknown', label: TYPE_LABEL.unknown, count: counts.unknown });
  }
  return entries.sort((a, b) => b.count - a.count);
};

export const aggregateTicketsByTechnician = (tickets: Ticket[]) => {
  const map = new Map<string, number>();
  for (const t of tickets) map.set(t.assigned_technician, (map.get(t.assigned_technician) ?? 0) + 1);
  return Array.from(map.entries())
    .map(([technician, count]) => ({ technician, count }))
    .sort((a, b) => b.count - a.count);
};

export const aggregateTicketsByDate = (tickets: Ticket[]) => {
  const map = new Map<string, number>();
  for (const t of tickets) {
    const date = new Date(t.opened_date).toISOString().split('T')[0];
    map.set(date, (map.get(date) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export const aggregatePlannedVsRealizedByCollaborator = (tickets: Ticket[]) => {
  const map = new Map<string, { collaborator: string; planned: number; realized: number; legacy: number }>();
  for (const t of tickets) {
    for (const c of t.collaborator_hours || []) {
      const cur = map.get(c.collaborator) ?? {
        collaborator: c.collaborator,
        planned: 0,
        realized: 0,
        legacy: 0,
      };
      cur.planned += c.planned_hours;
      cur.realized += c.realized_hours;
      cur.legacy += c.legacy_hours;
      map.set(c.collaborator, cur);
    }
  }

  return Array.from(map.values())
    .map(item => ({
      collaborator: item.collaborator,
      planned: roundHours(item.planned),
      realized: roundHours(item.realized),
      legacy: roundHours(item.legacy),
    }))
    .sort((a, b) => b.planned + b.realized + b.legacy - (a.planned + a.realized + a.legacy));
};

export const getUniqueTechnicians = (tickets: Ticket[]): string[] =>
  Array.from(new Set(tickets.map(t => t.assigned_technician))).sort();

export interface TechnicianMetrics {
  technician: string;
  total: number;
  open: number;
  finalized: number;
  staleCount: number;
  avgDaysOpen: number;
  totalRealizedHours: number;
  avgWorkHours: number;
  closureRate: number;
  totalByType: TypeBreakdown;
  openByType: TypeBreakdown;
}

export const getTechnicianMetrics = (
  tickets: Ticket[],
  technician: string,
  staleThresholdDays: number = config.ui.staleThresholdDays
): TechnicianMetrics => {
  const subset = tickets.filter(t => t.assigned_technician === technician);
  const m = getTicketMetrics(subset, staleThresholdDays);
  return {
    technician,
    total: m.total,
    open: m.open,
    finalized: m.finalized,
    staleCount: m.staleCount,
    avgDaysOpen: m.avgDaysOpen,
    totalRealizedHours: m.totalRealizedHours,
    avgWorkHours: m.avgWorkHours,
    closureRate: m.closureRate,
    totalByType: m.totalByType,
    openByType: m.openByType,
  };
};

export const getUniqueStatuses = (tickets: Ticket[]): string[] =>
  Array.from(new Set(tickets.map(t => t.status))).sort();

// ======================================================
// Heatmap dia-da-semana × hora
// ======================================================

export interface HeatmapCell {
  weekday: number; // 0=Dom..6=Sáb
  hour: number; // 0..23
  count: number;
}

export const aggregateTicketsHeatmap = (tickets: Ticket[]): HeatmapCell[] => {
  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const t of tickets) {
    const d = new Date(t.opened_date);
    if (Number.isNaN(d.getTime())) continue;
    matrix[d.getDay()][d.getHours()]++;
  }

  const cells: HeatmapCell[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({ weekday, hour, count: matrix[weekday][hour] });
    }
  }
  return cells;
};

// ======================================================
// Forecast linear (próximos N dias)
// ======================================================

export interface ForecastPoint {
  date: string;
  count: number | null;
  forecast: number | null;
}

export const forecastTicketsByDate = (
  data: { date: string; count: number }[],
  daysAhead = 7
): ForecastPoint[] => {
  if (data.length === 0) return [];
  // Regressão linear simples: y = a + b*x onde x é índice do dia.
  const n = data.length;
  const xs = data.map((_, i) => i);
  const ys = data.map(d => d.count);
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const b = den === 0 ? 0 : num / den;
  const a = meanY - b * meanX;

  const series: ForecastPoint[] = data.map(d => ({
    date: d.date,
    count: d.count,
    forecast: null,
  }));

  const lastDate = new Date(data[data.length - 1].date + 'T00:00:00');
  for (let i = 1; i <= daysAhead; i++) {
    const next = new Date(lastDate);
    next.setDate(next.getDate() + i);
    const x = n - 1 + i;
    const yHat = Math.max(0, Math.round(a + b * x));
    series.push({
      date: next.toISOString().split('T')[0],
      count: null,
      forecast: yHat,
    });
  }
  return series;
};

// ======================================================
// Comparação temporal (período anterior)
// ======================================================

export interface MetricsDelta {
  current: TicketMetrics;
  previous: TicketMetrics | null;
  deltas: {
    total: number | null;
    closureRate: number | null;
    open: number | null;
    avgWorkHours: number | null;
    staleCount: number | null;
  };
}

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

export const computeMetricsDelta = (
  currentMetrics: TicketMetrics,
  previousMetrics: TicketMetrics | null
): MetricsDelta => {
  if (!previousMetrics) {
    return {
      current: currentMetrics,
      previous: null,
      deltas: {
        total: null,
        closureRate: null,
        open: null,
        avgWorkHours: null,
        staleCount: null,
      },
    };
  }
  return {
    current: currentMetrics,
    previous: previousMetrics,
    deltas: {
      total: pct(currentMetrics.total, previousMetrics.total),
      closureRate: Math.round((currentMetrics.closureRate - previousMetrics.closureRate) * 10) / 10,
      open: pct(currentMetrics.open, previousMetrics.open),
      avgWorkHours:
        previousMetrics.avgWorkHours === 0
          ? null
          : Math.round(((currentMetrics.avgWorkHours - previousMetrics.avgWorkHours) /
              previousMetrics.avgWorkHours) * 1000) / 10,
      staleCount: pct(currentMetrics.staleCount, previousMetrics.staleCount),
    },
  };
};

/** Calcula o intervalo do período anterior, do mesmo tamanho, imediatamente antes do atual. */
export const getPreviousDateRange = (start: string, end: string) => {
  if (!start || !end) return null;
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  const diffMs = endDate.getTime() - startDate.getTime();
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd.getTime() - diffMs);
  return {
    start: prevStart.toISOString().split('T')[0],
    end: prevEnd.toISOString().split('T')[0],
  };
};

// ======================================================
// Insights & Action Items
// ======================================================

export type InsightTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface Insight {
  id: string;
  tone: InsightTone;
  emoji: string;
  text: string;
}

export type ActionSeverity = 'high' | 'medium' | 'low';

export interface ActionItemFilter {
  statuses?: string[];
  technicians?: string[];
  /** Apenas chamados parados há mais de N dias (não vai para a URL, apenas atalho explicativo). */
  staleOnly?: boolean;
}

export interface ActionItem {
  id: string;
  severity: ActionSeverity;
  title: string;
  description: string;
  /** Quando definido, o usuário pode aplicar esse filtro com 1 clique. */
  filter?: ActionItemFilter;
  /** Total de chamados afetados (mostrado em destaque). */
  count: number;
}

const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${value}%`;

export const generateInsights = (
  metrics: TicketMetrics,
  delta: MetricsDelta
): Insight[] => {
  const out: Insight[] = [];

  if (delta.previous && delta.deltas.total !== null) {
    const d = delta.deltas.total;
    const baseLow = delta.previous.total < 5;
    const direction = d > 0 ? 'subiu' : d < 0 ? 'caiu' : 'estável em';
    const text = baseLow
      ? `Volume de chamados: ${metrics.total} no período atual (variação ${formatPercent(d)} vs período anterior — base muito baixa, leitura instável).`
      : `Volume de chamados ${direction} ${formatPercent(d)} vs período anterior — passamos de ${delta.previous.total} para ${metrics.total} chamados no recorte.`;
    out.push({
      id: 'volume',
      tone: d > 20 ? 'warn' : d < -20 ? 'good' : 'neutral',
      emoji: d > 0 ? '↑' : d < 0 ? '↓' : '→',
      text,
    });
  }

  if (metrics.total > 0) {
    const tone: InsightTone =
      metrics.closureRate >= 80 ? 'good' : metrics.closureRate >= 50 ? 'neutral' : 'warn';
    out.push({
      id: 'closure',
      tone,
      emoji: tone === 'good' ? '✅' : tone === 'warn' ? '⚠️' : '•',
      text: `Taxa de resolução em ${metrics.closureRate}% — ${metrics.finalized} dos ${metrics.total} chamados foram finalizados (fechados ou solucionados) no período.`,
    });
  }

  if (metrics.staleCount > 0) {
    const plural = metrics.staleCount === 1 ? '' : 's';
    out.push({
      id: 'stale',
      tone: 'bad',
      emoji: '⏰',
      text: `${metrics.staleCount} chamado${plural} aberto${plural} há mais de ${metrics.staleThresholdDays} dias (limite definido para o time). Média atual de ${metrics.avgDaysOpen.toFixed(1)} dias em aberto — vale revisar prioridade ou fechamento.`,
    });
  } else if (metrics.open > 0) {
    out.push({
      id: 'stale',
      tone: 'good',
      emoji: '✅',
      text: `Nenhum chamado aberto acima do limite de ${metrics.staleThresholdDays} dias — backlog saudável.`,
    });
  }

  if (metrics.hoursBalanceType !== 'neutral' && metrics.totalRealizedHours > 0) {
    const isLoss = metrics.hoursBalanceType === 'loss';
    const balance = formatHoursMinutes(Math.abs(metrics.hoursBalance));
    out.push({
      id: 'hours',
      tone: isLoss ? 'warn' : 'good',
      emoji: isLoss ? '⏱' : '🎯',
      text: isLoss
        ? `Horas realizadas excedem o planejado em ${balance} — chamados estão consumindo mais esforço do que o estimado; vale revisar planejamento.`
        : `Ganho de ${balance} vs planejado — o time entregou em menos tempo do que havia estimado, indicando boa estimativa ou produtividade acima do plano.`,
    });
  }

  if (metrics.pendingHoursNotes > 0) {
    const plural = metrics.pendingHoursNotes === 1 ? '' : 's';
    out.push({
      id: 'hours-notes',
      tone: 'warn',
      emoji: '📝',
      text: `${metrics.pendingHoursNotes} chamado${plural} sem apontamento completo de horas (planejado e/ou realizado em branco) — ficam fora dos cálculos de eficiência até serem preenchidos.`,
    });
  }

  return out;
};

export const generateActionItems = (
  tickets: Ticket[],
  metrics: TicketMetrics,
  staleThresholdDays: number = config.ui.staleThresholdDays
): ActionItem[] => {
  const out: ActionItem[] = [];

  if (metrics.staleCount > 0) {
    out.push({
      id: 'review-stale',
      severity: metrics.staleCount > 5 ? 'high' : 'medium',
      title: `Revisar ${metrics.staleCount} chamado${metrics.staleCount === 1 ? '' : 's'} aberto${metrics.staleCount === 1 ? '' : 's'} há mais de ${staleThresholdDays}d`,
      description: `Em aberto há mais de ${staleThresholdDays} dias. Avaliar se ainda têm prioridade ou se deveriam ser fechados.`,
      filter: {
        statuses: ['Novo', 'Em Atendimento (atribuído)', 'Em Atendimento (planejado)', 'Pendente'],
        staleOnly: true,
      },
      count: metrics.staleCount,
    });
  }

  if (metrics.pendingHoursNotes > 0) {
    out.push({
      id: 'fill-hours',
      severity: metrics.pendingHoursNotes > 10 ? 'high' : 'medium',
      title: `Apontar horas em ${metrics.pendingHoursNotes} chamado${metrics.pendingHoursNotes === 1 ? '' : 's'}`,
      description:
        'Ficam fora dos cálculos de eficiência sem horas planejadas e/ou realizadas registradas.',
      count: metrics.pendingHoursNotes,
    });
  }

  // Sobrecarga: técnico com chamados em aberto >= 2× a média de abertos por técnico.
  const openTickets = tickets.filter(t =>
    ['Novo', 'Em Atendimento (atribuído)', 'Em Atendimento (planejado)', 'Pendente'].includes(t.status)
  );
  if (openTickets.length > 0) {
    const byTech = new Map<string, number>();
    for (const t of openTickets) {
      const name = t.assigned_technician || 'Não atribuído';
      byTech.set(name, (byTech.get(name) ?? 0) + 1);
    }
    if (byTech.size > 1) {
      const counts = Array.from(byTech.entries());
      const avg = openTickets.length / byTech.size;
      const overloaded = counts.filter(([, c]) => c >= Math.max(3, avg * 2));
      for (const [tech, count] of overloaded) {
        out.push({
          id: `workload-${tech}`,
          severity: count >= avg * 3 ? 'high' : 'medium',
          title: `${tech}: ${count} chamados em aberto`,
          description: `Carga ${(count / avg).toFixed(1)}× a média da equipe (${avg.toFixed(1)} por técnico).`,
          filter: { technicians: [tech] },
          count,
        });
      }
    }
  }

  if (metrics.newTickets > 0 && metrics.newTickets >= metrics.open * 0.5) {
    out.push({
      id: 'triage-new',
      severity: 'low',
      title: `${metrics.newTickets} chamado${metrics.newTickets === 1 ? '' : 's'} novo${metrics.newTickets === 1 ? '' : 's'} aguardando triagem`,
      description: 'Atribuir técnico ou definir prioridade para começar o atendimento.',
      filter: { statuses: ['Novo'] },
      count: metrics.newTickets,
    });
  }

  return out.sort((a, b) => {
    const order: Record<ActionSeverity, number> = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
};
