import { CollaboratorHours, Ticket, TicketHoursStatus, TicketTaskEntry } from '../types';
import { fetchTicketsFromGLPI, fetchMultipleTicketTaskEntries, isGLPIConfigured } from './glpiApi';

export const fetchTickets = async (
  startDate?: string,
  endDate?: string,
  statuses?: string[],
  _priorities?: string[], // Mantido para compatibilidade, mas não usado
  technicians?: string[]
): Promise<Ticket[]> => {
  // Usa a API do GLPI como fonte principal de dados
  if (isGLPIConfigured()) {
    const tickets = await fetchTicketsFromGLPI({
      startDate,
      endDate,
      statuses,
    });
    
    // Filtra por técnico localmente (se necessário)
    let filteredTickets = tickets;
    if (technicians && technicians.length > 0) {
      filteredTickets = tickets.filter(t => 
        technicians.includes(t.assigned_technician)
      );
    }
    
    return filteredTickets.sort(
      (a, b) => new Date(b.opened_date).getTime() - new Date(a.opened_date).getTime()
    );
  }

  // Se não houver API configurada, retorna array vazio com aviso
  console.warn('API GLPI não configurada. Configure as variáveis de ambiente.');
  return [];
};

/**
 * Busca as horas trabalhadas dos tickets e atualiza os dados
 * Deve ser chamado apenas quando há filtros aplicados (para otimização)
 */
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
    const hasStructuredEntry = entries.some(entry => entry.kind === 'planned' || entry.kind === 'realized');

    if (!hasStructuredEntry) {
      continue;
    }

    const ticketDate = getTicketDate(ticket);
    if (Number.isNaN(ticketDate)) {
      continue;
    }

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
  const plannedHours = roundHours(
    taskEntries
      .filter(entry => entry.kind === 'planned')
      .reduce((total, entry) => total + entry.hours, 0)
  );
  const realizedHours = roundHours(
    taskEntries
      .filter(entry => entry.kind === 'realized')
      .reduce((total, entry) => total + entry.hours, 0)
  );
  const legacyHours = roundHours(
    taskEntries
      .filter(entry => entry.kind === 'legacy')
      .reduce((total, entry) => total + entry.hours, 0)
  );

  ticket.planned_time_hours = plannedHours;
  ticket.realized_time_hours = realizedHours;
  ticket.legacy_time_hours = legacyHours;
  ticket.resolution_time_hours = roundHours(realizedHours + legacyHours);
  ticket.task_entries = taskEntries;
  ticket.collaborator_hours = aggregateCollaboratorHours(taskEntries);
  ticket.hours_status = getHoursStatus(
    ticket,
    plannedHours,
    realizedHours,
    legacyHours,
    firstStructuredTaskDate
  );
}

export const getTicketMetrics = (tickets: Ticket[]) => {
  const total = tickets.length;
  
  // Status do GLPI: Fechado, Solucionado (pode variar)
  const closed = tickets.filter(t => 
    t.status.toLowerCase().includes('fechado') || 
    t.status === 'Fechado'
  ).length;
  
  const solved = tickets.filter(t => 
    t.status.toLowerCase().includes('solucionado') || 
    t.status === 'Solucionado'
  ).length;
  
  // Em atendimento
  const inProgress = tickets.filter(t =>
    t.status.toLowerCase().includes('atendimento') ||
    t.status === 'Em Atendimento (atribuído)' ||
    t.status === 'Em Atendimento (planejado)'
  ).length;
  
  // Pendentes
  const pending = tickets.filter(t =>
    t.status.toLowerCase().includes('pendente') ||
    t.status === 'Pendente'
  ).length;
  
  // Novos
  const newTickets = tickets.filter(t =>
    t.status.toLowerCase() === 'novo' ||
    t.status === 'Novo'
  ).length;

  const totalPlannedHours = tickets.reduce((acc, t) => acc + (t.planned_time_hours || 0), 0);
  const totalRealizedHours = tickets.reduce((acc, t) => acc + (t.realized_time_hours || 0), 0);
  const totalLegacyHours = tickets.reduce((acc, t) => acc + (t.legacy_time_hours || 0), 0);
  const hoursBalance = totalPlannedHours - totalRealizedHours;
  const hoursBalanceType: 'gain' | 'loss' | 'neutral' =
    hoursBalance > 0 ? 'gain' : hoursBalance < 0 ? 'loss' : 'neutral';
  const totalHours = totalRealizedHours + totalLegacyHours;
  const ticketsWithHours = tickets.filter(t =>
    (t.realized_time_hours || 0) > 0 || (t.legacy_time_hours || 0) > 0
  );
  const avgWorkHours = ticketsWithHours.length > 0 ? totalHours / tickets.length : 0;
  const pendingHoursNotes = tickets.filter(t =>
    t.hours_status === 'missing_planned' ||
    t.hours_status === 'missing_realized' ||
    t.hours_status === 'missing_both'
  ).length;

  const closureRate = total > 0 ? ((closed + solved) / total) * 100 : 0;

  return {
    total,
    closed,
    solved,
    inProgress,
    pending,
    newTickets,
    avgWorkHours: Math.round(avgWorkHours * 10) / 10,
    totalWorkHours: Math.round(totalHours * 10) / 10,
    totalPlannedHours: Math.round(totalPlannedHours * 10) / 10,
    totalRealizedHours: Math.round(totalRealizedHours * 10) / 10,
    totalLegacyHours: Math.round(totalLegacyHours * 10) / 10,
    hoursBalance: Math.round(hoursBalance * 10) / 10,
    hoursBalanceType,
    pendingHoursNotes,
    closureRate: Math.round(closureRate * 10) / 10,
  };
};

export const aggregateTicketsByStatus = (tickets: Ticket[]) => {
  const aggregated = tickets.reduce((acc, ticket) => {
    const existing = acc.find(item => item.status === ticket.status);
    if (existing) {
      existing.count++;
    } else {
      acc.push({
        status: ticket.status,
        count: 1,
      });
    }
    return acc;
  }, [] as { status: string; count: number }[]);

  return aggregated.sort((a, b) => b.count - a.count);
};

export const aggregateTicketsByTechnician = (tickets: Ticket[]) => {
  const aggregated = tickets.reduce((acc, ticket) => {
    const existing = acc.find(item => item.technician === ticket.assigned_technician);
    if (existing) {
      existing.count++;
    } else {
      acc.push({
        technician: ticket.assigned_technician,
        count: 1,
      });
    }
    return acc;
  }, [] as { technician: string; count: number }[]);

  return aggregated.sort((a, b) => b.count - a.count);
};

export const aggregateTicketsByDate = (tickets: Ticket[]) => {
  const aggregated = tickets.reduce((acc, ticket) => {
    const date = new Date(ticket.opened_date).toISOString().split('T')[0];
    const existing = acc.find(item => item.date === date);
    if (existing) {
      existing.count++;
    } else {
      acc.push({
        date,
        count: 1,
      });
    }
    return acc;
  }, [] as { date: string; count: number }[]);

  return aggregated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export const aggregatePlannedVsRealizedByCollaborator = (tickets: Ticket[]) => {
  const grouped = tickets.reduce((acc, ticket) => {
    for (const collaborator of ticket.collaborator_hours || []) {
      const existing = acc.find(item => item.collaborator === collaborator.collaborator);
      if (existing) {
        existing.planned += collaborator.planned_hours;
        existing.realized += collaborator.realized_hours;
        existing.legacy += collaborator.legacy_hours;
      } else {
        acc.push({
          collaborator: collaborator.collaborator,
          planned: collaborator.planned_hours,
          realized: collaborator.realized_hours,
          legacy: collaborator.legacy_hours,
        });
      }
    }
    return acc;
  }, [] as { collaborator: string; planned: number; realized: number; legacy: number }[]);

  return grouped
    .map(item => ({
      collaborator: item.collaborator,
      planned: roundHours(item.planned),
      realized: roundHours(item.realized),
      legacy: roundHours(item.legacy),
    }))
    .sort((a, b) => (b.planned + b.realized + b.legacy) - (a.planned + a.realized + a.legacy));
};

export const getUniqueTechnicians = (tickets: Ticket[]): string[] => {
  const technicians = new Set(tickets.map(t => t.assigned_technician));
  return Array.from(technicians).sort();
};

export const getUniqueStatuses = (tickets: Ticket[]): string[] => {
  const statuses = new Set(tickets.map(t => t.status));
  return Array.from(statuses).sort();
};

// getUniquePriorities removido - não mais utilizado
