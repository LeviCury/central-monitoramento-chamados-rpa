/**
 * Integração com a API do GLPI - Central Minerva Foods
 * 
 * Documentação:
 * 1. Criar sessão: GET /initSession com Authorization Basic + App-Token
 * 2. Buscar tickets: POST /search/Ticket com Session-Token + App-Token
 */

import { Ticket } from '../types';

// Configuração da API
// Em desenvolvimento, usa proxy do Vite para contornar CORS
// Em produção, pode usar a URL direta se o servidor permitir CORS
const isDev = import.meta.env.DEV;
const GLPI_BASE_URL = isDev 
  ? '/api/glpi' // Proxy configurado no vite.config.ts
  : 'https://central.minervafoods.com/apirest.php';

const GLPI_AUTH_BASIC = import.meta.env.VITE_GLPI_AUTH_BASIC as string;
const GLPI_APP_TOKEN = import.meta.env.VITE_GLPI_APP_TOKEN as string;

// Validação das variáveis de ambiente
if (!GLPI_AUTH_BASIC || !GLPI_APP_TOKEN) {
  console.error('ERRO: Variáveis de ambiente VITE_GLPI_AUTH_BASIC e VITE_GLPI_APP_TOKEN são obrigatórias!');
}

// Cache do session token
let sessionToken: string | null = null;
let sessionExpiry: number = 0;

// Cache de usuários (ID -> Nome completo)
const userCache: Map<string, string> = new Map();

// Cache de horas trabalhadas por ticket (ticketId -> horas)
const ticketHoursCache: Map<string, number> = new Map();

// Constantes de tempo
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Feriados nacionais brasileiros (adicione mais conforme necessário)
 * Formato: 'MM-DD' para feriados fixos, 'YYYY-MM-DD' para feriados móveis
 */
const FERIADOS_FIXOS = [
  '01-01', // Confraternização Universal
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '12-25', // Natal
];

// Feriados móveis de 2024, 2025, 2026 (Carnaval, Sexta-feira Santa, Corpus Christi)
const FERIADOS_MOVEIS = [
  // 2024
  '2024-02-12', '2024-02-13', // Carnaval
  '2024-03-29', // Sexta-feira Santa
  '2024-05-30', // Corpus Christi
  // 2025
  '2025-03-03', '2025-03-04', // Carnaval
  '2025-04-18', // Sexta-feira Santa
  '2025-06-19', // Corpus Christi
  // 2026
  '2026-02-16', '2026-02-17', // Carnaval
  '2026-04-03', // Sexta-feira Santa
  '2026-06-04', // Corpus Christi
];

/**
 * Verifica se uma data é feriado
 */
function isFeriado(date: Date): boolean {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const yyyymmdd = `${date.getFullYear()}-${mmdd}`;
  
  return FERIADOS_FIXOS.includes(mmdd) || FERIADOS_MOVEIS.includes(yyyymmdd);
}

/**
 * Verifica se uma data é dia útil (não é fim de semana nem feriado)
 */
function isDiaUtil(date: Date): boolean {
  const dayOfWeek = date.getDay(); // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  if (isFeriado(date)) return false;
  return true;
}

/**
 * Retorna as horas de trabalho para um dia da semana
 * Seg-Qui: 9h (08:00-12:00 + 13:00-18:00)
 * Sexta: 8h (08:00-12:00 + 13:00-17:00)
 */
function getHorasTrabalho(dayOfWeek: number): { inicio1: number; fim1: number; inicio2: number; fim2: number; totalHoras: number } {
  if (dayOfWeek === 5) { // Sexta-feira
    return { inicio1: 8, fim1: 12, inicio2: 13, fim2: 17, totalHoras: 8 };
  }
  // Segunda a Quinta
  return { inicio1: 8, fim1: 12, inicio2: 13, fim2: 18, totalHoras: 9 };
}

/**
 * Calcula as horas úteis entre duas datas
 * Considera apenas horário comercial, excluindo almoço, fins de semana e feriados
 * 
 * Horários:
 * - Seg-Qui: 08:00-12:00 e 13:00-18:00 (9h/dia)
 * - Sexta: 08:00-12:00 e 13:00-17:00 (8h/dia)
 */
function calcularHorasUteis(dataInicio: Date, dataFim: Date): number {
  if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) {
    return 0;
  }
  
  if (dataFim <= dataInicio) {
    return 0;
  }
  
  let horasUteis = 0;
  
  // Itera dia a dia entre as duas datas
  const currentDay = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), dataInicio.getDate());
  const lastDay = new Date(dataFim.getFullYear(), dataFim.getMonth(), dataFim.getDate());
  
  let diasProcessados = 0;
  const maxDias = 365;
  
  while (currentDay <= lastDay && diasProcessados < maxDias) {
    if (isDiaUtil(currentDay)) {
      const dayOfWeek = currentDay.getDay();
      const horario = getHorasTrabalho(dayOfWeek);
      
      // Verifica se é o primeiro dia, último dia, ou dia intermediário
      const isFirstDay = currentDay.getTime() === new Date(dataInicio.getFullYear(), dataInicio.getMonth(), dataInicio.getDate()).getTime();
      const isLastDay = currentDay.getTime() === lastDay.getTime();
      
      if (isFirstDay && isLastDay) {
        // Mesmo dia: calcula apenas o período entre início e fim
        horasUteis += calcularHorasNoDia(dataInicio, dataFim, horario);
      } else if (isFirstDay) {
        // Primeiro dia: do horário de início até o fim do expediente
        const fimDoDia = new Date(currentDay.getTime());
        fimDoDia.setHours(horario.fim2, 0, 0, 0);
        horasUteis += calcularHorasNoDia(dataInicio, fimDoDia, horario);
      } else if (isLastDay) {
        // Último dia: do início do expediente até o horário de fim
        const inicioDoDia = new Date(currentDay.getTime());
        inicioDoDia.setHours(horario.inicio1, 0, 0, 0);
        horasUteis += calcularHorasNoDia(inicioDoDia, dataFim, horario);
      } else {
        // Dia intermediário: conta o dia inteiro de trabalho
        horasUteis += horario.totalHoras;
      }
    }
    
    currentDay.setDate(currentDay.getDate() + 1);
    diasProcessados++;
  }
  
  return Math.round(horasUteis * 10) / 10;
}

/**
 * Calcula as horas trabalhadas em um único dia, dado um período
 */
function calcularHorasNoDia(
  inicio: Date, 
  fim: Date, 
  horario: { inicio1: number; fim1: number; inicio2: number; fim2: number }
): number {
  let horas = 0;
  
  const inicioHora = inicio.getHours() + inicio.getMinutes() / 60;
  const fimHora = fim.getHours() + fim.getMinutes() / 60;
  
  // Período da manhã (ex: 08:00-12:00)
  const manhaInicio = Math.max(inicioHora, horario.inicio1);
  const manhaFim = Math.min(fimHora, horario.fim1);
  if (manhaFim > manhaInicio && inicioHora < horario.fim1 && fimHora > horario.inicio1) {
    horas += manhaFim - manhaInicio;
  }
  
  // Período da tarde (ex: 13:00-18:00)
  const tardeInicio = Math.max(inicioHora, horario.inicio2);
  const tardeFim = Math.min(fimHora, horario.fim2);
  if (tardeFim > tardeInicio && inicioHora < horario.fim2 && fimHora > horario.inicio2) {
    horas += tardeFim - tardeInicio;
  }
  
  return Math.max(0, horas);
}

/**
 * Busca as tarefas de um ticket e retorna o total de horas trabalhadas
 * GET /Ticket/{id}/TicketTask
 */
async function fetchTicketWorkHours(ticketId: string): Promise<number> {
  // Verifica cache
  if (ticketHoursCache.has(ticketId)) {
    return ticketHoursCache.get(ticketId)!;
  }
  
  if (!ticketId || ticketId === 'null' || ticketId === '') {
    return 0;
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
      // Ticket pode não ter tasks, retorna 0
      ticketHoursCache.set(ticketId, 0);
      return 0;
    }
    
    const tasks = await response.json();
    
    if (!Array.isArray(tasks)) {
      ticketHoursCache.set(ticketId, 0);
      return 0;
    }
    
    // Soma o actiontime de todas as tasks (em segundos)
    let totalSeconds = 0;
    for (const task of tasks) {
      if (task.actiontime && typeof task.actiontime === 'number') {
        totalSeconds += task.actiontime;
      }
    }
    
    // Converte para horas (arredonda para 1 casa decimal)
    const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;
    
    // Armazena no cache
    ticketHoursCache.set(ticketId, totalHours);
    
    return totalHours;
  } catch (error) {
    console.warn(`[GLPI] Erro ao buscar tasks do ticket ${ticketId}:`, error);
    ticketHoursCache.set(ticketId, 0);
    return 0;
  }
}

/**
 * Busca as horas trabalhadas de múltiplos tickets
 * Exportada para ser usada sob demanda (quando há filtros aplicados)
 */
export async function fetchMultipleTicketWorkHours(ticketIds: string[]): Promise<Map<string, number>> {
  // Filtra IDs que não estão no cache
  const idsToFetch = ticketIds.filter(id => !ticketHoursCache.has(id));
  
  if (idsToFetch.length === 0) {
    return ticketHoursCache;
  }
  
  console.log(`[GLPI] Buscando horas trabalhadas de ${idsToFetch.length} tickets...`);
  
  // Busca em lotes para não sobrecarregar a API
  const batchSize = 5; // Reduzido para evitar sobrecarga
  for (let i = 0; i < idsToFetch.length; i += batchSize) {
    const batch = idsToFetch.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(id => fetchTicketWorkHours(id)));
    
    // Delay entre lotes para não sobrecarregar
    if (i + batchSize < idsToFetch.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return ticketHoursCache;
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
  
  return sessionToken;
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
    value: params.entityId || '108', // Padrão: grupo 108 (RPA)
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
  const solveDelay = raw['155'] ?? raw.solve_delay_stat ?? null;
  
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
