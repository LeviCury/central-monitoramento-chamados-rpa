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
} as const;

export const STATUS_MAP: Record<number, string> = {
  1: 'Novo',
  2: 'Em Atendimento (atribuído)',
  3: 'Em Atendimento (planejado)',
  4: 'Pendente',
  5: 'Solucionado',
  6: 'Fechado',
};

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
