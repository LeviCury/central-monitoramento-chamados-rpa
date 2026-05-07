/**
 * Busca de tickets na API GLPI: monta critérios, faz POST /search/Ticket,
 * normaliza nomes de técnicos/solicitantes e devolve `Ticket[]`.
 */

import { config } from '../../config';
import { Ticket } from '../../types';
import { glpiFetch } from './session';
import { fetchUserNames, getUserCache } from './users';
import {
  GLPI_FIELDS,
  PRIORITY_MAP,
  STATUS_MAP,
  STATUS_NAME_TO_ID,
  PRIORITY_NAME_TO_ID,
  TYPE_MAP,
} from './constants';
import {
  glpiSearchResponseSchema,
  GlpiTicketRaw,
} from './schemas';

export interface GLPISearchParams {
  startDate?: string;
  endDate?: string;
  /** Grupo técnico (campo 8). Se vazio, usa `config.glpi.defaultGroupId`. */
  groupId?: string;
  /** Entidade GLPI (campo 80). Se vazio, usa `config.glpi.entityId`. */
  entityId?: string;
  statuses?: string[];
  priorities?: string[];
  technicians?: string[];
  range?: string;
  signal?: AbortSignal;
}

/**
 * Pega de canto a configuracao classica errada de mandar o mesmo ID em
 * VITE_GLPI_ENTITY_ID e VITE_GLPI_GROUP_ID — geralmente o user pensou
 * que "108" era a entidade quando na verdade e o grupo tecnico, e o
 * GLPI devolve 0 chamados sem erro nenhum (a entidade simplesmente
 * nao existe). Loga uma vez por sessao no console.
 */
let warnedAboutDuplicatedId = false;
function warnIfEntityEqualsGroup(entityValue: string | null, groupValue: string | null) {
  if (warnedAboutDuplicatedId) return;
  if (!entityValue || !groupValue) return;
  if (entityValue !== groupValue) return;
  warnedAboutDuplicatedId = true;
  console.warn(
    `[GLPI] VITE_GLPI_ENTITY_ID e VITE_GLPI_GROUP_ID estao com o mesmo valor (${entityValue}). ` +
      'Isso quase sempre e bug de configuracao: 108 e o ID do GRUPO tecnico, nao da entidade. ' +
      'Se voce esta vendo "0 chamados" sem erro, deixe VITE_GLPI_ENTITY_ID vazio (apenas grupo basta). ' +
      'Veja docs/INFRA-CORS.md / .env.example.'
  );
}

function buildSearchCriteria(params: GLPISearchParams): object[] {
  const criteria: object[] = [];

  // Sempre filtrar por entidade (campo 80). Isso impede que tickets
  // de outras unidades organizacionais entrem no resultado.
  // Usamos `under` (não `equals`): a entidade configurada e suas filhas.
  // No GLPI, `equals` em entity costuma exigir o ID interno em vez do nome,
  // e algumas instalações ignoram o critério silenciosamente.
  const entityValue = params.entityId || config.glpi.entityId;
  const groupValue = params.groupId || config.glpi.defaultGroupId;
  warnIfEntityEqualsGroup(entityValue, groupValue);

  if (entityValue) {
    criteria.push({
      link: 'AND',
      field: GLPI_FIELDS.ENTITY,
      searchtype: 'under',
      value: entityValue,
    });
  }

  // E também por grupo técnico (campo 8) — fila do RPA.
  // `under` (grupo + subgrupos) é mais robusto que `equals`,
  // que em algumas instalações do GLPI é silenciosamente ignorado.
  if (groupValue) {
    criteria.push({
      link: 'AND',
      field: GLPI_FIELDS.TECHNICIAN_GROUP,
      searchtype: 'under',
      value: groupValue,
    });
  }

  if (params.startDate) {
    criteria.push({
      link: 'AND',
      field: GLPI_FIELDS.DATE_MOD,
      searchtype: 'morethan',
      value: `${params.startDate} 00:00:00`,
    });
  }

  if (params.endDate) {
    criteria.push({
      link: 'AND',
      field: GLPI_FIELDS.DATE_MOD,
      searchtype: 'lessthan',
      value: `${params.endDate} 23:59:59`,
    });
  }

  if (params.statuses && params.statuses.length > 0) {
    params.statuses.forEach((status, index) => {
      const statusId = STATUS_NAME_TO_ID[status];
      criteria.push({
        link: index === 0 ? 'AND' : 'OR',
        field: GLPI_FIELDS.STATUS,
        searchtype: 'equals',
        value: statusId ?? status,
      });
    });
  }

  if (params.priorities && params.priorities.length > 0) {
    params.priorities.forEach((priority, index) => {
      const priorityId = PRIORITY_NAME_TO_ID[priority];
      criteria.push({
        link: index === 0 ? 'AND' : 'OR',
        field: GLPI_FIELDS.PRIORITY,
        searchtype: 'equals',
        value: priorityId ?? priority,
      });
    });
  }

  return criteria;
}

/**
 * Resolve `type` do GLPI tanto quando vem como número (1/2) quanto
 * como string ("Incidente"/"Requisição") com expand_dropdowns=true.
 */
function resolveTicketType(raw: unknown): 'incident' | 'request' | 'unknown' {
  if (raw == null) return 'unknown';
  if (typeof raw === 'number') {
    if (raw === 1) return 'incident';
    if (raw === 2) return 'request';
    return 'unknown';
  }
  const text = String(raw).trim().toLowerCase();
  if (text === '1' || text.startsWith('incid')) return 'incident';
  if (text === '2' || text.startsWith('requis') || text.startsWith('request')) return 'request';
  return 'unknown';
}

function parseGLPITicket(raw: GlpiTicketRaw): Ticket {
  const id = raw['2'] ?? raw.id ?? '';
  const title = raw['1'] ?? raw.name ?? '';
  const entity = raw['80'] ?? raw.entity ?? '';
  const status = raw['12'] ?? raw.status ?? '';
  const priority = raw['3'] ?? raw.priority ?? '';
  const typeRaw = raw['14'] ?? raw.type ?? null;
  const requester = raw['4'] ?? raw.requester ?? '';
  const technician = raw['5'] ?? raw.technician ?? '';
  const techGroup = raw['8'] ?? raw.technician_group ?? '';
  const dateOpened = raw['15'] ?? raw.date ?? '';
  const dateMod = raw['19'] ?? raw.date_mod ?? '';
  const dateSolved = raw['17'] ?? raw.solvedate ?? null;
  const dateClosed = raw['16'] ?? raw.closedate ?? null;
  const category = raw['7'] ?? raw.category ?? '';

  const statusText =
    typeof status === 'number' ? STATUS_MAP[status] ?? `Status ${status}` : String(status);
  const priorityText =
    typeof priority === 'number'
      ? PRIORITY_MAP[priority] ?? `Prioridade ${priority}`
      : String(priority);
  const ticketType = resolveTicketType(typeRaw);
  void TYPE_MAP; // mapeamento exposto para outros consumidores

  return {
    id: String(id),
    title: String(title),
    entity: String(entity),
    assigned_technician: String(technician),
    status: statusText,
    type: ticketType,
    opened_date: String(dateOpened),
    updated_date: String(dateMod),
    resolved_date: dateSolved ? String(dateSolved) : dateClosed ? String(dateClosed) : null,
    requester: String(requester),
    priority: priorityText,
    tags: String(category),
    technical_group: String(techGroup),
    resolution_time_hours: null,
    planned_time_hours: 0,
    realized_time_hours: 0,
    legacy_time_hours: 0,
    hours_status: 'not_loaded',
    task_entries: [],
    collaborator_hours: [],
    created_at: String(dateOpened),
  };
}

export async function fetchTicketsFromGLPI(params: GLPISearchParams): Promise<Ticket[]> {
  const criteria = buildSearchCriteria(params);

  const requestBody = {
    criteria,
    range: params.range || '0-2000',
    forcedisplay: [
      GLPI_FIELDS.ID,
      GLPI_FIELDS.NAME,
      GLPI_FIELDS.ENTITY,
      GLPI_FIELDS.STATUS,
      GLPI_FIELDS.PRIORITY,
      GLPI_FIELDS.TYPE,
      GLPI_FIELDS.REQUESTER,
      GLPI_FIELDS.TECHNICIAN,
      GLPI_FIELDS.TECHNICIAN_GROUP,
      GLPI_FIELDS.DATE_OPENED,
      GLPI_FIELDS.DATE_MOD,
      GLPI_FIELDS.DATE_SOLVED,
      GLPI_FIELDS.DATE_CLOSED,
      GLPI_FIELDS.CATEGORY,
      GLPI_FIELDS.SOLVE_DELAY,
    ],
  };

  console.log('[GLPI] Buscando tickets com critérios:', JSON.stringify(requestBody));

  const response = await glpiFetch('/search/Ticket?expand_dropdowns=true', {
    method: 'POST',
    body: JSON.stringify(requestBody),
    signal: params.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao buscar tickets: ${response.status} - ${errorText}`);
  }

  const json = await response.json();
  const parsed = glpiSearchResponseSchema.safeParse(json);
  if (!parsed.success) {
    console.warn('[GLPI] Resposta inesperada de /search/Ticket', parsed.error);
    return [];
  }

  const list = Array.isArray(parsed.data) ? parsed.data : parsed.data.data ?? [];
  const totalCount =
    !Array.isArray(parsed.data) && typeof parsed.data.totalcount === 'number'
      ? parsed.data.totalcount
      : null;

  // Alerta quando bate o teto do range — sinal de filtro frouxo ou range pequeno.
  const [, rangeEndStr] = (requestBody.range || '0-2000').split('-');
  const rangeEnd = Number(rangeEndStr);
  const hitLimit = Number.isFinite(rangeEnd) && list.length >= rangeEnd + 1;
  if (hitLimit || (totalCount && totalCount > list.length)) {
    console.warn(
      `[GLPI] Atenção: ${list.length} tickets retornados` +
        (totalCount ? ` (totalcount=${totalCount})` : '') +
        '. Pode estar truncado pelo range ou faltando filtro. ' +
        'Critérios enviados: ' +
        JSON.stringify(criteria)
    );
  } else {
    console.log(`[GLPI] ${list.length} tickets encontrados`);
  }

  const parsedTickets = list.map(parseGLPITicket);

  // Resolve nomes de técnico/solicitante.
  try {
    const userIds: string[] = [];
    for (const t of parsedTickets) {
      if (t.assigned_technician && t.assigned_technician !== 'null') userIds.push(t.assigned_technician);
      if (t.requester && t.requester !== 'null') userIds.push(t.requester);
    }
    if (userIds.length > 0) {
      const cache = await fetchUserNames(userIds);
      for (const t of parsedTickets) {
        const techId = t.assigned_technician;
        if (techId && cache.has(techId)) t.assigned_technician = cache.get(techId)!;
        else if (techId && /^\d+$/.test(techId)) t.assigned_technician = `Técnico #${techId}`;
        else if (!techId || techId === 'null') t.assigned_technician = 'Não atribuído';

        const reqId = t.requester;
        if (reqId && cache.has(reqId)) t.requester = cache.get(reqId)!;
        else if (reqId && /^\d+$/.test(reqId)) t.requester = `Usuário #${reqId}`;
        else if (!reqId || reqId === 'null') t.requester = 'Desconhecido';
      }
    }
  } catch (userError) {
    console.warn('[GLPI] Erro ao buscar nomes de usuários:', userError);
    const cache = getUserCache();
    for (const t of parsedTickets) {
      if (t.assigned_technician && cache.has(t.assigned_technician)) {
        t.assigned_technician = cache.get(t.assigned_technician)!;
      } else if (t.assigned_technician && /^\d+$/.test(t.assigned_technician)) {
        t.assigned_technician = `Técnico #${t.assigned_technician}`;
      } else if (!t.assigned_technician || t.assigned_technician === 'null') {
        t.assigned_technician = 'Não atribuído';
      }
    }
  }

  return parsedTickets;
}
