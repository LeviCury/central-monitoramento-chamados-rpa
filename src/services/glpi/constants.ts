/**
 * Constantes e mapeamentos de campos do GLPI.
 *
 * Documentação: https://glpi-project.org/doc/
 */

export const GLPI_FIELDS = {
  ID: 2,
  NAME: 1,
  ENTITY: 80,
  STATUS: 12,
  PRIORITY: 3,
  URGENCY: 10,
  IMPACT: 11,
  /** 14 = type (1 = Incidente, 2 = Requisição) */
  TYPE: 14,
  REQUESTER: 4,
  TECHNICIAN: 5,
  TECHNICIAN_GROUP: 8,
  DATE_OPENED: 15,
  DATE_MOD: 19,
  DATE_SOLVED: 17,
  DATE_CLOSED: 16,
  CATEGORY: 7,
  TIME_TO_RESOLVE: 30,
  /**
   * 49 = actiontime do ticket. O GLPI ja agrega automaticamente o
   * tempo de TODAS as TicketTask filhas. Vem em segundos. Usar isso
   * em vez de buscar task-a-task evita 758 requests adicionais.
   */
  ACTION_TIME: 49,
  SOLVE_DELAY: 155,
} as const;

export const TYPE_MAP: Record<number, string> = {
  1: 'Incidente',
  2: 'Requisição',
};

export const STATUS_MAP: Record<number, string> = {
  1: 'Novo',
  2: 'Em Atendimento (atribuído)',
  3: 'Em Atendimento (planejado)',
  4: 'Pendente',
  5: 'Solucionado',
  6: 'Fechado',
};

/**
 * IDs dos status considerados "em aberto" (chamado vivo na fila).
 * Usado pelo split de requests no `fetchTicketsFromGLPI`: chamados nesses
 * status são SEMPRE retornados, independente do filtro de data — porque
 * "se está aberto, aparece" (regra do produto).
 */
export const OPEN_STATUS_IDS = [1, 2, 3, 4] as const;

/**
 * IDs dos status considerados "finalizados" (solucionado/fechado).
 * O filtro de data SÓ se aplica a estes — usando `solvedate` (campo 17)
 * em vez de `date_mod` (campo 19), porque queremos saber em que período
 * o chamado foi efetivamente resolvido.
 */
export const CLOSED_STATUS_IDS = [5, 6] as const;

/**
 * Tokens (case-insensitive) que, se encontrados no caminho de categoria
 * do chamado, causam EXCLUSÃO total: o chamado nem entra no sistema —
 * não conta em KPI, não aparece em tabela, não vai pra exports.
 *
 * Motivação (Minerva): chamados em "RPA > Novo RPA" são PROJETOS de
 * automação, não atendimento operacional. O dashboard é exclusivamente
 * para a fila de atendimento.
 *
 * O filtro é aplicado em `fetchTicketsRaw` (logo após o GLPI responder,
 * antes do enriquecimento de nomes) por substring case-insensitive, pra
 * pegar tanto "RPA > Novo RPA" quanto qualquer subcategoria abaixo dele.
 *
 * Adicione novos tokens aqui se outras categorias precisarem ser ignoradas.
 */
export const EXCLUDED_CATEGORY_TOKENS: readonly string[] = ['Novo RPA'];

export const PRIORITY_MAP: Record<number, string> = {
  1: 'Muito Baixa',
  2: 'Baixa',
  3: 'Média',
  4: 'Alta',
  5: 'Muito Alta',
  6: 'Maior',
};

/** Inverso útil para resolver string -> id */
export const STATUS_NAME_TO_ID: Record<string, number> = Object.fromEntries(
  Object.entries(STATUS_MAP).map(([id, name]) => [name, Number(id)])
);

export const PRIORITY_NAME_TO_ID: Record<string, number> = Object.fromEntries(
  Object.entries(PRIORITY_MAP).map(([id, name]) => [name, Number(id)])
);
