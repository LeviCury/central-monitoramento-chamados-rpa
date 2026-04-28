/**
 * Integração com a API do GLPI - Central Minerva Foods
 * 
 * Documentação:
 * 1. Criar sessão: GET /initSession com Authorization Basic + App-Token
 * 2. Buscar tickets: POST /search/Ticket com Session-Token + App-Token
 */

import { Ticket, TicketTaskEntry, TicketTaskKind } from '../types';

// Configuração da API
// Em desenvolvimento, usa proxy do Vite para contornar CORS
// Em produção, pode usar a URL direta se o servidor permitir CORS
const isDev = import.meta.env.DEV;
const GLPI_BASE_URL = isDev 
  ? '/api/glpi' // Proxy configurado no vite.config.ts
  : 'https://central.minervafoods.com/apirest.php';

const GLPI_AUTH_BASIC = import.meta.env.VITE_GLPI_AUTH_BASIC as string;
const GLPI_APP_TOKEN = import.meta.env.VITE_GLPI_APP_TOKEN as string;
const GLPI_ENTITY_ID = import.meta.env.VITE_GLPI_ENTITY_ID as string | undefined;

// Validação das variáveis de ambiente
if (!GLPI_AUTH_BASIC || !GLPI_APP_TOKEN) {
  console.error('ERRO: Variáveis de ambiente VITE_GLPI_AUTH_BASIC e VITE_GLPI_APP_TOKEN são obrigatórias!');
}

// Cache do session token
let sessionToken: string | null = null;
let sessionExpiry: number = 0;

// Cache de usuários (ID -> Nome completo)
const userCache: Map<string, string> = new Map();

// Cache de apontamentos por ticket (ticketId -> tarefas RPA filtradas)
const ticketTaskCache: Map<string, TicketTaskEntry[]> = new Map();

// Constantes de tempo
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutos
const PLANNED_TASK_CATEGORY_ID = 15;
const REALIZED_TASK_CATEGORY_ID = 16;

const ALLOWED_COLLABORATOR_ALIASES: Record<string, string> = {
  'Levi Ribeiro Cury': 'Levi Ribeiro Cury',
  'Igor Martins Mununcio': 'Igor Martins Mununcio',
  'Igor Martins Minuncio': 'Igor Martins Mununcio',
  'Guilherme Bretanha Franco Fernandes': 'Guilherme Bretanha Franco Fernandes',
  'Daniel Eduardo Fernandes dos Santos': 'Daniel Eduardo Fernandes dos Santos',
};

/**
 * Normaliza nomes para comparar os usuários do GLPI sem depender de acentos,
 * maiúsculas/minúsculas ou espaços duplicados.
 */
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const ALLOWED_COLLABORATOR_MAP = new Map(
  Object.entries(ALLOWED_COLLABORATOR_ALIASES).map(([alias, canonical]) => [
    normalizeName(alias),
    canonical,
  ])
);

function getAllowedCollaboratorName(name: string): string | null {
  return ALLOWED_COLLABORATOR_MAP.get(normalizeName(name)) ?? null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function getTaskKind(categoryId: number | null): TicketTaskKind {
  if (categoryId === PLANNED_TASK_CATEGORY_ID) return 'planned';
  if (categoryId === REALIZED_TASK_CATEGORY_ID) return 'realized';
  return 'legacy';
}

function getTaskUserId(task: Record<string, unknown>): string {
  const userId = task.users_id ?? task.users_id_tech ?? task.users_id_editor ?? task.user_id;
  return userId == null ? '' : String(userId);
}

async function resolveTaskCollaborator(task: Record<string, unknown>): Promise<string | null> {
  const taskUser = getTaskUserId(task);
  if (!taskUser) return null;

  const directMatch = getAllowedCollaboratorName(taskUser);
  if (directMatch) return directMatch;

  if (/^\d+$/.test(taskUser)) {
    const resolvedUser = await fetchUserName(taskUser);
    return getAllowedCollaboratorName(resolvedUser);
  }

  return null;
}

/**
 * Busca as tarefas de um ticket e retorna apenas apontamentos dos colaboradores RPA.
 * GET /Ticket/{id}/TicketTask
 */
async function fetchTicketTaskEntries(ticketId: string): Promise<TicketTaskEntry[]> {
  if (ticketTaskCache.has(ticketId)) {
    return ticketTaskCache.get(ticketId)!;
  }
  
  if (!ticketId || ticketId === 'null' || ticketId === '') {
    return [];
  }
  
  const token = await getValidSessionToken();
  
  try {
    const response = await fetch(`${GLPI_BASE_URL}/Ticket/${ticketId}/TicketTask`, {
      method: 'GET',
      headers: {
        'Session-Token': token,
        'App-Token': GLPI_APP_TOKEN,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      // Ticket pode não ter tasks, retorna lista vazia
      ticketTaskCache.set(ticketId, []);
      return [];
    }
    
    const tasks = await response.json();
    
    if (!Array.isArray(tasks)) {
      ticketTaskCache.set(ticketId, []);
      return [];
    }
    
    const entries: TicketTaskEntry[] = [];

    for (const rawTask of tasks as Record<string, unknown>[]) {
      const actionTime = toNumber(rawTask.actiontime);
      if (!actionTime || actionTime <= 0) {
        continue;
      }

      const collaborator = await resolveTaskCollaborator(rawTask);

      if (!collaborator) {
        continue;
      }

      const categoryId = toNumber(rawTask.taskcategories_id);
      const taskId = rawTask.id ?? rawTask['2'] ?? `${ticketId}-${entries.length + 1}`;
      const taskDate = rawTask.date ?? rawTask.date_creation ?? rawTask.date_mod ?? null;
      const content = rawTask.content ?? rawTask.name ?? '';
      const hours = Math.round((actionTime / 3600) * 10) / 10;

      entries.push({
        id: String(taskId),
        ticket_id: ticketId,
        collaborator,
        category_id: categoryId,
        kind: getTaskKind(categoryId),
        hours,
        content: String(content).replace(/<[^>]+>/g, '').trim(),
        date: taskDate ? String(taskDate) : null,
      });
    }

    ticketTaskCache.set(ticketId, entries);

    return entries;
  } catch (error) {
    console.warn(`[GLPI] Erro ao buscar tasks do ticket ${ticketId}:`, error);
    ticketTaskCache.set(ticketId, []);
    return [];
  }
}

/**
 * Busca os apontamentos de múltiplos tickets.
 * Exportada para ser usada sob demanda (quando há filtros aplicados)
 */
export async function fetchMultipleTicketTaskEntries(ticketIds: string[]): Promise<Map<string, TicketTaskEntry[]>> {
  // Filtra IDs que não estão no cache
  const idsToFetch = ticketIds.filter(id => !ticketTaskCache.has(id));
  
  if (idsToFetch.length === 0) {
    return ticketTaskCache;
  }
  
  console.log(`[GLPI] Buscando apontamentos de ${idsToFetch.length} tickets...`);
  
  // Busca em lotes para não sobrecarregar a API
  const batchSize = 5; // Reduzido para evitar sobrecarga
  for (let i = 0; i < idsToFetch.length; i += batchSize) {
    const batch = idsToFetch.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(id => fetchTicketTaskEntries(id)));
    
    // Delay entre lotes para não sobrecarregar
    if (i + batchSize < idsToFetch.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return ticketTaskCache;
}

/**
 * Cria uma nova sessão no GLPI e retorna o session_token
 */
async function createSession(): Promise<string> {
  console.log('[GLPI] Criando nova sessão...');
  
  const response = await fetch(`${GLPI_BASE_URL}/initSession/`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${GLPI_AUTH_BASIC}`,
      'App-Token': GLPI_APP_TOKEN,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[GLPI] Erro ao criar sessão:', response.status, errorText);
    throw new Error(`Falha ao criar sessão GLPI: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.session_token) {
    throw new Error('Resposta do GLPI não contém session_token');
  }

  console.log('[GLPI] Sessão criada com sucesso');
  
  // Armazena o token e define expiração
  sessionToken = data.session_token;
  sessionExpiry = Date.now() + SESSION_DURATION_MS;
  
  return data.session_token as string;
}

/**
 * Obtém um session token válido (cria novo se necessário)
 */
async function getValidSessionToken(): Promise<string> {
  // Se não tem token ou está expirado, cria novo
  if (!sessionToken || Date.now() >= sessionExpiry) {
    return await createSession();
  }
  return sessionToken;
}

/**
 * Invalida a sessão atual (útil em caso de erro 401)
 */
function invalidateSession(): void {
  sessionToken = null;
  sessionExpiry = 0;
}

/**
 * Busca os dados de um usuário pelo ID
 * Retorna o nome completo (firstname + realname)
 */
async function fetchUserName(userId: string): Promise<string> {
  // Verifica se já está no cache
  if (userCache.has(userId)) {
    return userCache.get(userId)!;
  }
  
  // IDs inválidos
  if (!userId || userId === 'null' || userId === '0' || userId === '') {
    return 'Não atribuído';
  }
  
  const token = await getValidSessionToken();
  
  try {
    const response = await fetch(`${GLPI_BASE_URL}/User/${userId}`, {
      method: 'GET',
      headers: {
        'Session-Token': token,
        'App-Token': GLPI_APP_TOKEN,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.warn(`[GLPI] Erro ao buscar usuário ${userId}:`, response.status);
      return `Técnico #${userId}`;
    }
    
    const data = await response.json();
    
    // Monta o nome completo: firstname + realname (sobrenome)
    const firstname = data.firstname || '';
    const realname = data.realname || '';
    const fullName = `${firstname} ${realname}`.trim() || data.name || `Técnico #${userId}`;
    
    // Armazena no cache
    userCache.set(userId, fullName);
    
    return fullName;
  } catch (error) {
    console.error(`[GLPI] Erro ao buscar usuário ${userId}:`, error);
    return `Técnico #${userId}`;
  }
}

/**
 * Busca os nomes de múltiplos usuários de uma vez
 * Busca sequencialmente para evitar sobrecarregar a API
 */
async function fetchUserNames(userIds: string[]): Promise<Map<string, string>> {
  // Filtra IDs únicos e válidos que não estão no cache
  const uniqueIds = [...new Set(userIds)].filter(
    id => id && id !== 'null' && id !== '0' && id !== '' && !userCache.has(id)
  );
  
  if (uniqueIds.length === 0) {
    return userCache;
  }
  
  // Limita a quantidade de usuários para buscar (evita muitas requisições)
  const maxUsersToFetch = 30;
  const idsToFetch = uniqueIds.slice(0, maxUsersToFetch);
  
  console.log(`[GLPI] Buscando nomes de ${idsToFetch.length} usuários (de ${uniqueIds.length} únicos)...`);
  
  // Busca em lotes pequenos com delay entre eles
  const batchSize = 5;
  for (let i = 0; i < idsToFetch.length; i += batchSize) {
    const batch = idsToFetch.slice(i, i + batchSize);
    
    // Busca o lote em paralelo
    await Promise.allSettled(batch.map(id => fetchUserName(id)));
    
    // Pequeno delay entre lotes para não sobrecarregar
    if (i + batchSize < idsToFetch.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return userCache;
}

/**
 * Mapeamento de campos do GLPI
 * Documentação: https://glpi-project.org/doc/
 */
const GLPI_FIELDS = {
  ID: 2,
  NAME: 1,
  ENTITY: 80,
  STATUS: 12,
  PRIORITY: 3,
  URGENCY: 10,
  IMPACT: 11,
  REQUESTER: 4,
  TECHNICIAN: 5,
  TECHNICIAN_GROUP: 8,
  DATE_OPENED: 15,
  DATE_MOD: 19,
  DATE_SOLVED: 17,
  DATE_CLOSED: 16,
  CATEGORY: 7,
  TIME_TO_RESOLVE: 30,
  SOLVE_DELAY: 155,
};

/**
 * Mapeamento de status do GLPI para texto legível
 */
const STATUS_MAP: Record<number, string> = {
  1: 'Novo',
  2: 'Em Atendimento (atribuído)',
  3: 'Em Atendimento (planejado)',
  4: 'Pendente',
  5: 'Solucionado',
  6: 'Fechado',
};

/**
 * Mapeamento de prioridade do GLPI para texto legível
 */
const PRIORITY_MAP: Record<number, string> = {
  1: 'Muito Baixa',
  2: 'Baixa',
  3: 'Média',
  4: 'Alta',
  5: 'Muito Alta',
  6: 'Maior',
};

export interface GLPISearchParams {
  startDate?: string;
  endDate?: string;
  entityId?: string;
  statuses?: string[];
  priorities?: string[];
  technicians?: string[];
  range?: string;
}

/**
 * Constrói os critérios de busca para a API do GLPI
 */
function buildSearchCriteria(params: GLPISearchParams): object[] {
  const criteria: object[] = [];
  
  // Filtro por entidade (grupo técnico) - field 8 = grupo técnico
  // O valor 108 parece ser o ID do grupo RPA
  criteria.push({
    link: 'AND',
    field: GLPI_FIELDS.TECHNICIAN_GROUP,
    searchtype: 'equals',
    value: params.entityId || GLPI_ENTITY_ID || '108', // Padrão: grupo 108 (RPA)
  });
  
  // Filtro por data inicial (data de modificação/fechamento)
  if (params.startDate) {
    criteria.push({
      link: 'AND',
      field: GLPI_FIELDS.DATE_MOD,
      searchtype: 'morethan',
      value: `${params.startDate} 00:00:00`,
    });
  }
  
  // Filtro por data final
  if (params.endDate) {
    criteria.push({
      link: 'AND',
      field: GLPI_FIELDS.DATE_MOD,
      searchtype: 'lessthan',
      value: `${params.endDate} 23:59:59`,
    });
  }
  
  // Filtro por status
  if (params.statuses && params.statuses.length > 0) {
    const statusCriteria = params.statuses.map((status, index) => {
      // Encontra o ID do status pelo nome
      const statusId = Object.entries(STATUS_MAP).find(([, name]) => name === status)?.[0];
      return {
        link: index === 0 ? 'AND' : 'OR',
        field: GLPI_FIELDS.STATUS,
        searchtype: 'equals',
        value: statusId || status,
      };
    });
    criteria.push(...statusCriteria);
  }
  
  // Filtro por prioridade
  if (params.priorities && params.priorities.length > 0) {
    const priorityCriteria = params.priorities.map((priority, index) => {
      // Encontra o ID da prioridade pelo nome
      const priorityId = Object.entries(PRIORITY_MAP).find(([, name]) => name === priority)?.[0];
      return {
        link: index === 0 ? 'AND' : 'OR',
        field: GLPI_FIELDS.PRIORITY,
        searchtype: 'equals',
        value: priorityId || priority,
      };
    });
    criteria.push(...priorityCriteria);
  }
  
  return criteria;
}

/**
 * Converte um registro do GLPI para o formato Ticket do dashboard
 */
function parseGLPITicket(raw: Record<string, unknown>): Ticket {
  // O GLPI retorna campos numerados, precisamos mapear
  const id = raw['2'] ?? raw.id ?? '';
  const title = raw['1'] ?? raw.name ?? '';
  const entity = raw['80'] ?? raw.entity ?? '';
  const status = raw['12'] ?? raw.status ?? '';
  const priority = raw['3'] ?? raw.priority ?? '';
  const requester = raw['4'] ?? raw.requester ?? '';
  const technician = raw['5'] ?? raw.technician ?? '';
  const techGroup = raw['8'] ?? raw.technician_group ?? '';
  const dateOpened = raw['15'] ?? raw.date ?? '';
  const dateMod = raw['19'] ?? raw.date_mod ?? '';
  const dateSolved = raw['17'] ?? raw.solvedate ?? null;
  const dateClosed = raw['16'] ?? raw.closedate ?? null;
  const category = raw['7'] ?? raw.category ?? '';
  
  // Converte status numérico para texto
  const statusText = typeof status === 'number' 
    ? STATUS_MAP[status] || `Status ${status}`
    : String(status);
  
  // Converte prioridade numérica para texto
  const priorityText = typeof priority === 'number'
    ? PRIORITY_MAP[priority] || `Prioridade ${priority}`
    : String(priority);
  
  // O tempo de resolução será preenchido depois com as horas trabalhadas (actiontime das tasks)
  // Inicialmente fica nulo e será atualizado após buscar as tasks de cada ticket
  
  return {
    id: String(id),
    title: String(title),
    entity: String(entity),
    assigned_technician: String(technician),
    status: statusText,
    opened_date: String(dateOpened),
    updated_date: String(dateMod),
    resolved_date: dateSolved ? String(dateSolved) : (dateClosed ? String(dateClosed) : null),
    requester: String(requester),
    priority: priorityText,
    tags: String(category),
    technical_group: String(techGroup),
    resolution_time_hours: null, // Será preenchido com horas trabalhadas das tasks
    planned_time_hours: 0,
    realized_time_hours: 0,
    legacy_time_hours: 0,
    hours_status: 'not_loaded',
    task_entries: [],
    collaborator_hours: [],
    created_at: String(dateOpened),
  };
}

/**
 * Busca tickets no GLPI com os filtros especificados
 */
export async function fetchTicketsFromGLPI(params: GLPISearchParams): Promise<Ticket[]> {
  const token = await getValidSessionToken();
  
  const criteria = buildSearchCriteria(params);
  
  const requestBody = {
    criteria,
    range: params.range || '0-2000',
    // Campos que queremos retornar
    forcedisplay: [
      GLPI_FIELDS.ID,
      GLPI_FIELDS.NAME,
      GLPI_FIELDS.ENTITY,
      GLPI_FIELDS.STATUS,
      GLPI_FIELDS.PRIORITY,
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
  
  console.log('[GLPI] Buscando tickets com critérios:', JSON.stringify(requestBody, null, 2));
  
  try {
    // expand_dropdowns=true faz o GLPI retornar nomes ao invés de IDs
    // para campos relacionados (técnico, solicitante, categoria, etc.)
    const response = await fetch(`${GLPI_BASE_URL}/search/Ticket?expand_dropdowns=true`, {
      method: 'POST',
      headers: {
        'Session-Token': token,
        'App-Token': GLPI_APP_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (response.status === 401) {
      // Token expirado, invalida e tenta novamente
      console.log('[GLPI] Token expirado, renovando sessão...');
      invalidateSession();
      return fetchTicketsFromGLPI(params);
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GLPI] Erro na busca:', response.status, errorText);
      throw new Error(`Erro ao buscar tickets: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    // A resposta do GLPI pode ter diferentes formatos
    let tickets: Record<string, unknown>[] = [];
    
    if (Array.isArray(data)) {
      tickets = data;
    } else if (data && typeof data === 'object') {
      // Formato: { totalcount, count, data: [...] }
      if (Array.isArray(data.data)) {
        tickets = data.data;
      }
    }
    
    console.log(`[GLPI] ${tickets.length} tickets encontrados`);
    
    // Converte os tickets para o formato interno
    const parsedTickets = tickets.map(parseGLPITicket);
    
    // Tenta buscar os nomes dos usuários (opcional - não quebra se falhar)
    try {
      // Coleta todos os IDs de usuários únicos (técnicos e solicitantes)
      const userIds: string[] = [];
      
      for (const ticket of parsedTickets) {
        if (ticket.assigned_technician && ticket.assigned_technician !== 'null') {
          userIds.push(ticket.assigned_technician);
        }
        if (ticket.requester && ticket.requester !== 'null') {
          userIds.push(ticket.requester);
        }
      }
      
      // Busca os nomes dos usuários
      if (userIds.length > 0) {
        await fetchUserNames(userIds);
        
        // Substitui os IDs pelos nomes
        for (const ticket of parsedTickets) {
          // Técnico
          const techId = ticket.assigned_technician;
          if (techId && userCache.has(techId)) {
            ticket.assigned_technician = userCache.get(techId)!;
          } else if (techId && techId !== 'null' && techId !== '') {
            if (/^\d+$/.test(techId)) {
              ticket.assigned_technician = `Técnico #${techId}`;
            }
          } else {
            ticket.assigned_technician = 'Não atribuído';
          }
          
          // Solicitante
          const reqId = ticket.requester;
          if (reqId && userCache.has(reqId)) {
            ticket.requester = userCache.get(reqId)!;
          } else if (reqId && reqId !== 'null' && reqId !== '') {
            if (/^\d+$/.test(reqId)) {
              ticket.requester = `Usuário #${reqId}`;
            }
          } else {
            ticket.requester = 'Desconhecido';
          }
        }
      }
    } catch (userError) {
      console.warn('[GLPI] Erro ao buscar nomes de usuários (continuando com IDs):', userError);
      // Formata os IDs que não foram resolvidos
      for (const ticket of parsedTickets) {
        if (ticket.assigned_technician && /^\d+$/.test(ticket.assigned_technician)) {
          ticket.assigned_technician = `Técnico #${ticket.assigned_technician}`;
        } else if (!ticket.assigned_technician || ticket.assigned_technician === 'null') {
          ticket.assigned_technician = 'Não atribuído';
        }
        
        if (ticket.requester && /^\d+$/.test(ticket.requester)) {
          ticket.requester = `Usuário #${ticket.requester}`;
        } else if (!ticket.requester || ticket.requester === 'null') {
          ticket.requester = 'Desconhecido';
        }
      }
    }
    
    // NÃO busca horas trabalhadas aqui - será feito sob demanda via fetchTicketWorkHoursForList
    
    return parsedTickets;
    
  } catch (error) {
    console.error('[GLPI] Erro na requisição:', error);
    throw error;
  }
}

/**
 * Encerra a sessão atual no GLPI (opcional, para limpeza)
 */
export async function killSession(): Promise<void> {
  if (!sessionToken) return;
  
  try {
    await fetch(`${GLPI_BASE_URL}/killSession/`, {
      method: 'GET',
      headers: {
        'Session-Token': sessionToken,
        'App-Token': GLPI_APP_TOKEN,
      },
    });
    console.log('[GLPI] Sessão encerrada');
  } catch (error) {
    console.error('[GLPI] Erro ao encerrar sessão:', error);
  } finally {
    invalidateSession();
  }
}

/**
 * Verifica se a API do GLPI está configurada e acessível
 */
export function isGLPIConfigured(): boolean {
  return Boolean(GLPI_APP_TOKEN);
}

/**
 * Testa a conexão com a API do GLPI
 */
export async function testConnection(): Promise<boolean> {
  try {
    await getValidSessionToken();
    return true;
  } catch {
    return false;
  }
}
