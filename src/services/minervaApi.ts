import { Ticket } from '../types';

const MINERVA_API_URL = import.meta.env.VITE_MINERVA_API_URL as string | undefined;

export interface MinervaTicketsParams {
  startDate?: string;
  endDate?: string;
  statuses?: string[];
  priorities?: string[];
  technicians?: string[];
}

function isTicketArray(value: unknown): value is Ticket[] {
  return Array.isArray(value) && value.length >= 0;
}

function normalizeTicket(raw: Record<string, unknown>): Ticket {
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    entity: String(raw.entity ?? ''),
    assigned_technician: String(raw.assigned_technician ?? raw.assignedTechnician ?? ''),
    status: String(raw.status ?? ''),
    opened_date: String(raw.opened_date ?? raw.openedDate ?? ''),
    updated_date: String(raw.updated_date ?? raw.updatedDate ?? ''),
    resolved_date: raw.resolved_date != null || raw.resolvedDate != null
      ? String(raw.resolved_date ?? raw.resolvedDate)
      : null,
    requester: String(raw.requester ?? ''),
    priority: String(raw.priority ?? ''),
    tags: String(raw.tags ?? ''),
    technical_group: String(raw.technical_group ?? raw.technicalGroup ?? ''),
    resolution_time_hours:
      raw.resolution_time_hours != null || raw.resolutionTimeHours != null
        ? Number(raw.resolution_time_hours ?? raw.resolutionTimeHours)
        : null,
    planned_time_hours:
      raw.planned_time_hours != null || raw.plannedTimeHours != null
        ? Number(raw.planned_time_hours ?? raw.plannedTimeHours)
        : 0,
    realized_time_hours:
      raw.realized_time_hours != null || raw.realizedTimeHours != null
        ? Number(raw.realized_time_hours ?? raw.realizedTimeHours)
        : 0,
    legacy_time_hours:
      raw.legacy_time_hours != null || raw.legacyTimeHours != null
        ? Number(raw.legacy_time_hours ?? raw.legacyTimeHours)
        : 0,
    hours_status: 'not_loaded',
    task_entries: [],
    collaborator_hours: [],
    created_at: String(raw.created_at ?? raw.createdAt ?? ''),
  };
}

function parseResponse(body: unknown): Ticket[] {
  if (isTicketArray(body)) {
    return body.map(t => (typeof t === 'object' && t !== null ? normalizeTicket(t as unknown as Record<string, unknown>) : t));
  }
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    const list = (obj.tickets ?? obj.data) as unknown;
    if (Array.isArray(list)) {
      return list.map(t => normalizeTicket((t as Record<string, unknown>) ?? {}));
    }
  }
  return [];
}

/**
 * Busca tickets na API do site Minerva com os filtros informados.
 * URL base: VITE_MINERVA_API_URL (ex: https://api.minerva.com.br/tickets)
 * Query params: startDate, endDate, status, priority, technician (múltiplos repetidos ou separados por vírgula)
 */
export async function fetchTicketsFromMinervaApi(params: MinervaTicketsParams): Promise<Ticket[]> {
  if (!MINERVA_API_URL?.trim()) {
    throw new Error(
      'VITE_MINERVA_API_URL não está configurada. Defina no .env a URL base da API Minerva (ex: https://api.minerva.com.br/tickets).'
    );
  }

  const url = new URL(MINERVA_API_URL);
  if (params.startDate) url.searchParams.set('startDate', params.startDate);
  if (params.endDate) url.searchParams.set('endDate', params.endDate);
  if (params.statuses?.length) url.searchParams.set('status', params.statuses.join(','));
  if (params.priorities?.length) url.searchParams.set('priority', params.priorities.join(','));
  if (params.technicians?.length) url.searchParams.set('technician', params.technicians.join(','));

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`API Minerva: ${res.status} ${res.statusText}`);
  }

  const body = await res.json();
  return parseResponse(body);
}

export function isMinervaApiConfigured(): boolean {
  return Boolean(MINERVA_API_URL?.trim());
}
