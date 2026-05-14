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
  OPEN_STATUS_IDS,
  CLOSED_STATUS_IDS,
  EXCLUDED_CATEGORY_TOKENS,
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
 * Variante interna de `GLPISearchParams` usada pela `fetchTicketsRaw`. Permite
 * que o orquestrador (`fetchTicketsFromGLPI`) injete:
 *
 * - `_statusId`: UM único ID de status (singular, não array). Por quê? Porque
 *   a API search do GLPI processa criteria de forma "plana" (sem parênteses):
 *   se enviarmos `AND status=1 OR status=2 OR status=3`, a precedência SQL
 *   transforma em `(... AND status=1) OR status=2 OR status=3` — e os
 *   filtros de grupo/entidade ficam aplicados SÓ ao primeiro status, fazendo
 *   o sistema retornar chamados de filas erradas. A solução é disparar UMA
 *   request por status, com tudo AND simples, e fazer dedupe no orquestrador.
 * - `_dateField`: qual campo do GLPI usar no filtro de data. Default é
 *   `DATE_MOD` (legado); a request "finalizados no período" usa `DATE_SOLVED`.
 *
 * Esses campos são internos e não fazem parte da API pública porque são
 * detalhes da estratégia de split (ver doc de `fetchTicketsFromGLPI`).
 */
interface GLPISearchParamsInternal extends GLPISearchParams {
  _statusId?: number;
  _dateField?: number;
}

/**
 * Heuristica de seguranca: na Minerva, `108` e o ID do GRUPO tecnico
 * (RPA), nao da entidade. Quando alguem cola `108` tambem em
 * VITE_GLPI_ENTITY_ID, o GLPI procura tickets em uma entidade
 * inexistente e devolve 0 chamados sem erro.
 *
 * Em vez de obrigar o user a corrigir a env var no Vercel, o app
 * detecta a colisao e simplesmente DESCARTA o filtro de entidade,
 * deixando apenas o filtro por grupo — que e o que funciona. Isso
 * e seguro porque filtrar so por grupo e mais restritivo que
 * filtrar por (entidade=108 AND grupo=108).
 *
 * Loga 1 vez por sessao no console explicando o que foi feito.
 */
let warnedAboutDuplicatedId = false;
function resolveEntityValue(
  entityValueRaw: string | null,
  groupValue: string | null
): string | null {
  if (!entityValueRaw) return null;
  if (entityValueRaw && groupValue && entityValueRaw === groupValue) {
    if (!warnedAboutDuplicatedId) {
      warnedAboutDuplicatedId = true;
      console.warn(
        `[GLPI] VITE_GLPI_ENTITY_ID e VITE_GLPI_GROUP_ID estao com o mesmo valor (${entityValueRaw}). ` +
          'Provavel bug de configuraçao: na Minerva, 108 e o ID do GRUPO tecnico, nao da entidade. ' +
          'O app esta IGNORANDO o filtro de entidade automaticamente (so o grupo basta). ' +
          'Para silenciar este aviso, deixe VITE_GLPI_ENTITY_ID vazio nas variaveis do Vercel/.env.'
      );
    }
    return null;
  }
  return entityValueRaw;
}

function buildSearchCriteria(params: GLPISearchParamsInternal): object[] {
  const criteria: object[] = [];

  const entityValueRaw = params.entityId || config.glpi.entityId;
  const groupValue = params.groupId || config.glpi.defaultGroupId;
  const entityValue = resolveEntityValue(entityValueRaw, groupValue);

  // Filtro por entidade (campo 80). Usamos `under` (não `equals`): a
  // entidade configurada e suas filhas. Em algumas instalações do GLPI
  // o `equals` em entity exige o ID interno em vez do nome, e o critério
  // é ignorado silenciosamente.
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

  // Campo do GLPI usado para filtrar a janela de data. O default `DATE_MOD`
  // (campo 19 = última atualização) preserva o comportamento legado para
  // chamadas sem `_dateField`. O orquestrador `fetchTicketsFromGLPI` usa
  // `DATE_SOLVED` (campo 17) na request de finalizados, porque o que importa
  // ali é "quando o chamado foi resolvido", não quando teve qualquer mexida.
  const dateField = params._dateField ?? GLPI_FIELDS.DATE_MOD;

  if (params.startDate) {
    criteria.push({
      link: 'AND',
      field: dateField,
      searchtype: 'morethan',
      value: `${params.startDate} 00:00:00`,
    });
  }

  if (params.endDate) {
    criteria.push({
      link: 'AND',
      field: dateField,
      searchtype: 'lessthan',
      value: `${params.endDate} 23:59:59`,
    });
  }

  // Status: prioriza ID explícito singular (`_statusId`). É o formato usado
  // pelo orquestrador, que dispara UMA request por status — tudo AND, sem
  // OR ambíguo. Cai pra `statuses` (nomes) na chamada legada sem orquestração.
  if (typeof params._statusId === 'number') {
    criteria.push({
      link: 'AND',
      field: GLPI_FIELDS.STATUS,
      searchtype: 'equals',
      value: params._statusId,
    });
  } else if (params.statuses && params.statuses.length > 0) {
    // ATENÇÃO: este bloco gera múltiplos critérios AND/OR e tem o mesmo
    // problema de precedência descrito em `_statusId`. Só é alcançado pelo
    // atalho legado (sem filtro de data E sem split). O orquestrador
    // garante que múltiplos status sejam disparados como N requests.
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

function parseTicketActionSeconds(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    // Pode vir formatado como "01h30" / "1h 30min" quando expand_dropdowns=true.
    // Tenta numero direto primeiro; se falhar, parseia "Xh Ymin".
    const num = Number(trimmed);
    if (Number.isFinite(num)) return num;
    const match = trimmed.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*min)?/i);
    if (match) {
      const h = Number(match[1] || 0);
      const m = Number(match[2] || 0);
      return h * 3600 + m * 60;
    }
  }
  return 0;
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
  // GLPI ja agrega o tempo de TODAS as TicketTask filhas no campo 49.
  // Usamos isso como fonte de verdade para "total realizado", sem
  // depender de buscas task-a-task (que sao caras e podem filtrar
  // colaborador / categoria).
  const actionSecondsRaw = (raw as Record<string, unknown>)['49'] ?? raw.actiontime;
  const actionSeconds = parseTicketActionSeconds(actionSecondsRaw);
  const realizedHoursFromTicket = Math.round((actionSeconds / 3600) * 10) / 10;

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
    resolution_time_hours: realizedHoursFromTicket || null,
    planned_time_hours: 0,
    // Pre-popula com o agregado do GLPI. Se depois `fetchWorkHoursForTickets`
    // rodar e trouxer breakdown por colaborador/categoria, sobrescreve com
    // o detalhamento. Mas garante que NUNCA fica em zero por causa de filtro.
    realized_time_hours: realizedHoursFromTicket,
    legacy_time_hours: 0,
    hours_status: realizedHoursFromTicket > 0 ? 'legacy' : 'not_loaded',
    task_entries: [],
    collaborator_hours: [],
    created_at: String(dateOpened),
  };
}

/**
 * Calcula a interseção entre os status pedidos pelo usuário (por nome) e
 * uma "bucket" pré-definida de IDs (abertos ou finalizados). Retorna:
 *
 * - `null` se o usuário não pediu status nenhum → usar a bucket inteira
 *   (sem restrição extra).
 * - Lista de IDs do bucket que estavam entre os pedidos pelo usuário
 *   (pode ser vazia → essa request nem precisa rodar).
 *
 * Tolera nomes que não estão no map (ignora silenciosamente — coerente
 * com o comportamento legado de `buildSearchCriteria`).
 */
function intersectRequestedStatuses(
  requestedNames: string[] | undefined,
  bucket: readonly number[]
): number[] | null {
  if (!requestedNames || requestedNames.length === 0) {
    // Sem restrição → usar a bucket inteira (mas como `null` para sinalizar
    // "sem filtro de status do usuário"; o caller decide).
    return null;
  }
  const requestedIds = new Set(
    requestedNames
      .map(name => STATUS_NAME_TO_ID[name])
      .filter((id): id is number => typeof id === 'number')
  );
  return bucket.filter(id => requestedIds.has(id));
}

/** Deduplicação por id, preservando o primeiro a chegar (ordem da lista). */
function dedupeById(tickets: Ticket[]): Ticket[] {
  const seen = new Set<string>();
  const out: Ticket[] = [];
  for (const t of tickets) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

/**
 * Verifica se a categoria de um ticket bate em algum token excluído
 * (case-insensitive, por substring). Centralizado pra ficar fácil testar
 * mentalmente: se quiser excluir mais categorias, edite o array em
 * `EXCLUDED_CATEGORY_TOKENS` em `constants.ts`.
 */
function isCategoryExcluded(category: string): boolean {
  if (!category) return false;
  const normalized = category.toLowerCase();
  for (const token of EXCLUDED_CATEGORY_TOKENS) {
    if (normalized.includes(token.toLowerCase())) return true;
  }
  return false;
}

/**
 * "Plano" de uma das N requests do split: qual status, se aplica filtro
 * de data, e qual campo de data usar.
 */
interface StatusFetchPlan {
  statusId: number;
  applyDate: boolean;
  dateField: number;
}

/**
 * Fetcher PÚBLICO de tickets. Implementa a regra de produto:
 *
 *   "Se está aberto, aparece. O filtro de data só decide quais
 *    finalizados aparecem."
 *
 * IMPORTANTE — Por que N requests em vez de 1?
 *
 * A API search do GLPI processa criteria de forma PLANA (sem parênteses).
 * Múltiplos status com OR (ex.: `AND grupo=108 AND status=1 OR status=2 ...`)
 * sofrem precedência tipo SQL e viram `(grupo=108 AND status=1) OR status=2`,
 * o que vaza chamados de OUTRAS filas. A solução robusta é disparar UMA
 * request por status, com tudo AND simples, e fazer dedupe no fim.
 *
 * Atalho de performance: se NÃO há filtro de data E NÃO há statuses pedidos
 * pelo usuário → 1 request única sem critério de status (legado, igual antes).
 *
 * Caso geral:
 *   - Sem filtro de data: 1 request por status pedido (ou TODOS, se vazio).
 *   - Com filtro de data:
 *       - 1 request por status ABERTO, SEM filtro de data ("abertos sagrados").
 *       - 1 request por status FINALIZADO, com filtro por DATE_SOLVED.
 *   - Os resultados das N requests são unidos e deduplicados por id.
 */
export async function fetchTicketsFromGLPI(params: GLPISearchParams): Promise<Ticket[]> {
  const hasDateFilter = !!(params.startDate || params.endDate);
  const userPickedStatuses = (params.statuses?.length ?? 0) > 0;

  // Atalho legado: sem filtro de data E sem statuses do usuário → 1 request,
  // sem critério de status, igual ao comportamento de antes da refatoração.
  if (!hasDateFilter && !userPickedStatuses) {
    return fetchTicketsRaw(params);
  }

  const plan = buildStatusFetchPlan(params, hasDateFilter);

  if (plan.length === 0) {
    // Edge case: usuário pediu status que não está em nenhuma bucket.
    return [];
  }

  if (config.isDev) {
    console.info(
      `[GLPI] Disparando ${plan.length} request(s) em paralelo ` +
        `(uma por status) para evitar bug de precedência OR/AND no GLPI search.`
    );
  }

  const tasks = plan.map(p =>
    fetchTicketsRaw({
      ...params,
      statuses: undefined,                                  // resolvido via _statusId
      startDate: p.applyDate ? params.startDate : undefined,
      endDate: p.applyDate ? params.endDate : undefined,
      _statusId: p.statusId,
      _dateField: p.dateField,
    })
  );

  const lists = await Promise.all(tasks);
  return dedupeById(lists.flat());
}

/**
 * Monta o plano de N requests a partir dos parâmetros do usuário.
 *
 * Regras:
 *   - Status ABERTOS (1-4): NUNCA recebem filtro de data (regra de produto:
 *     "se está aberto, aparece").
 *   - Status FINALIZADOS (5-6): recebem filtro de data SE houver, usando
 *     `DATE_SOLVED` (campo 17, "quando foi solucionado") em vez de `DATE_MOD`.
 *   - Se o usuário escolheu status manualmente, intersectamos com cada bucket;
 *     senão, usamos a bucket inteira.
 */
function buildStatusFetchPlan(
  params: GLPISearchParams,
  hasDateFilter: boolean
): StatusFetchPlan[] {
  const plan: StatusFetchPlan[] = [];

  const openIds = intersectRequestedStatuses(params.statuses, OPEN_STATUS_IDS);
  const closedIds = intersectRequestedStatuses(params.statuses, CLOSED_STATUS_IDS);

  // `null` = usuário não restringiu status → usar bucket inteira.
  const openBucket = openIds === null ? [...OPEN_STATUS_IDS] : openIds;
  const closedBucket = closedIds === null ? [...CLOSED_STATUS_IDS] : closedIds;

  for (const statusId of openBucket) {
    plan.push({
      statusId,
      applyDate: false,                       // abertos ignoram data
      dateField: GLPI_FIELDS.DATE_MOD,        // irrelevante (applyDate=false)
    });
  }

  for (const statusId of closedBucket) {
    plan.push({
      statusId,
      applyDate: hasDateFilter,
      dateField: GLPI_FIELDS.DATE_SOLVED,     // "quando foi solucionado"
    });
  }

  return plan;
}

/**
 * Fetcher RAW: faz uma única request em /search/Ticket com os critérios
 * passados. É a versão "low-level" que preserva 100% o comportamento
 * legado da antiga `fetchTicketsFromGLPI`. Hoje é usada por:
 *   - `fetchTicketsFromGLPI` (fluxo público sem filtro de data)
 *   - `fetchTicketsFromGLPI` (cada uma das 2 requests do split)
 */
async function fetchTicketsRaw(params: GLPISearchParamsInternal): Promise<Ticket[]> {
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
      GLPI_FIELDS.ACTION_TIME,
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

  const allParsedTickets = list.map(parseGLPITicket);

  // Filtra categorias excluídas (ex.: "RPA > Novo RPA" são PROJETOS, não
  // chamados de atendimento — não devem aparecer em nenhum lugar do app).
  // Aplicado ANTES do enriquecimento de nomes pra economizar requests
  // de usuário desnecessárias.
  const parsedTickets = allParsedTickets.filter(t => !isCategoryExcluded(t.tags));
  const excludedCount = allParsedTickets.length - parsedTickets.length;
  if (excludedCount > 0) {
    console.info(
      `[GLPI] ${excludedCount} chamado(s) descartado(s) por categoria excluída ` +
        `(${EXCLUDED_CATEGORY_TOKENS.join(', ')}). ` +
        `${parsedTickets.length} restante(s) entram no painel.`
    );
  }

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
