export type TicketTaskKind = 'planned' | 'realized' | 'legacy';

export type TicketHoursStatus =
  | 'not_loaded'
  | 'complete'
  | 'missing_planned'
  | 'missing_realized'
  | 'missing_both'
  | 'legacy'
  | 'no_rpa_tasks';

export interface TicketTaskEntry {
  id: string;
  ticket_id: string;
  collaborator: string;
  category_id: number | null;
  kind: TicketTaskKind;
  hours: number;
  content: string;
  date: string | null;
}

export interface CollaboratorHours {
  collaborator: string;
  planned_hours: number;
  realized_hours: number;
  legacy_hours: number;
  tasks: TicketTaskEntry[];
}

export type TicketType = 'incident' | 'request' | 'unknown';

export interface Ticket {
  id: string;
  title: string;
  entity: string;
  assigned_technician: string;
  status: string;
  /**
   * Tipo do chamado no GLPI (campo 14):
   * - `incident`  = Incidente (problema que afetou operação)
   * - `request`   = Requisição (solicitação, melhoria, projeto)
   * - `unknown`   = quando o GLPI não devolveu o campo
   */
  type: TicketType;
  opened_date: string;
  updated_date: string;
  resolved_date: string | null;
  requester: string;
  priority: string;
  tags: string;
  technical_group: string;
  resolution_time_hours: number | null;
  planned_time_hours: number;
  realized_time_hours: number;
  legacy_time_hours: number;
  hours_status: TicketHoursStatus;
  task_entries: TicketTaskEntry[];
  collaborator_hours: CollaboratorHours[];
  created_at: string;
}

export interface FilterState {
  dateRange: {
    start: string;
    end: string;
  };
  statuses: string[];
  priorities: string[];
  technicians: string[];
  /** Lista de tipos selecionados: 'incident' | 'request'. Vazio = todos. */
  types: TicketType[];
}
