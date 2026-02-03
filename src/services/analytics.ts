import { Ticket } from '../types';
import { fetchTicketsFromGLPI, fetchMultipleTicketWorkHours, isGLPIConfigured } from './glpiApi';

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
  const hoursCache = await fetchMultipleTicketWorkHours(ticketIds);
  
  // Atualiza os tickets com as horas trabalhadas
  for (const ticket of tickets) {
    const hours = hoursCache.get(ticket.id);
    if (hours !== undefined && hours > 0) {
      ticket.resolution_time_hours = hours;
    }
  }
  
  return tickets;
};

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

  // Média de horas trabalhadas (apenas se houver dados)
  const ticketsWithHours = tickets.filter(t => t.resolution_time_hours && t.resolution_time_hours > 0);
  const totalHours = ticketsWithHours.reduce((acc, t) => acc + (t.resolution_time_hours || 0), 0);
  const avgWorkHours = ticketsWithHours.length > 0 ? totalHours / tickets.length : 0;

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

export const getUniqueTechnicians = (tickets: Ticket[]): string[] => {
  const technicians = new Set(tickets.map(t => t.assigned_technician));
  return Array.from(technicians).sort();
};

export const getUniqueStatuses = (tickets: Ticket[]): string[] => {
  const statuses = new Set(tickets.map(t => t.status));
  return Array.from(statuses).sort();
};

// getUniquePriorities removido - não mais utilizado
