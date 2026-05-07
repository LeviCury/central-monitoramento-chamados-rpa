/**
 * Configuração tipada e centralizada da aplicação.
 *
 * Lê todas as variáveis VITE_* do `import.meta.env`, valida e expõe
 * objetos prontos para uso no código (sem strings espalhadas).
 */

const env = import.meta.env;

const isDev = env.DEV;

export interface RpaCollaborator {
  canonical: string;
  aliases: string[];
}

export interface GlpiGroup {
  id: string;
  name: string;
}

function parseCollaborators(raw: string | undefined): RpaCollaborator[] {
  if (!raw) return [];
  return raw
    .split('|')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const names = entry.split(',').map(n => n.trim()).filter(Boolean);
      const [canonical, ...aliases] = names;
      return { canonical, aliases };
    })
    .filter(item => Boolean(item.canonical));
}

function parseGroups(raw: string | undefined): GlpiGroup[] {
  if (!raw) return [{ id: '108', name: 'RPA' }];
  const groups = raw
    .split('|')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const [id, ...rest] = entry.split(':');
      const name = rest.join(':').trim() || `Grupo ${id}`;
      return { id: id.trim(), name };
    })
    .filter(g => Boolean(g.id));

  return groups.length > 0 ? groups : [{ id: '108', name: 'RPA' }];
}

function parseStaleDays(raw: string | undefined): number {
  const value = Number((raw ?? '').trim());
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 7;
}

// Entidade é OPCIONAL. Se você não definir VITE_GLPI_ENTITY_ID,
// o filtro de entidade não é enviado ao GLPI — apenas o de grupo.
// Em muitos GLPIs o ID `108` é o grupo técnico e não há entidade
// com mesmo número, então deixar vazio é o comportamento seguro.
const rawEntityId = (env.VITE_GLPI_ENTITY_ID as string | undefined)?.trim();
const rawGroupId = (env.VITE_GLPI_GROUP_ID as string | undefined)?.trim() || '108';

export const config = {
  isDev,
  glpi: {
    baseUrl: isDev ? '/api/glpi' : 'https://central.minervafoods.com/apirest.php',
    publicUrl: 'https://central.minervafoods.com',
    authBasic: (env.VITE_GLPI_AUTH_BASIC as string | undefined) ?? '',
    appToken: (env.VITE_GLPI_APP_TOKEN as string | undefined) ?? '',
    /** Entidade GLPI (campo 80). `null` = não filtrar por entidade. */
    entityId: rawEntityId || null,
    /**
     * Grupo técnico GLPI (campo 8). Quando definido, restringe à fila
     * daquele grupo. Default = `108` (RPA). Também usado como `defaultGroupId`
     * pelo seletor de grupo no header.
     */
    defaultGroupId: rawGroupId,
    sessionDurationMs: 30 * 60 * 1000,
    plannedTaskCategoryId: 15,
    realizedTaskCategoryId: 16,
  },
  groups: parseGroups(env.VITE_GLPI_GROUPS as string | undefined),
  collaborators: parseCollaborators(
    env.VITE_RPA_COLLABORATORS as string | undefined
  ),
  ui: {
    autoRefreshMinutes: 20,
    /**
     * Acima deste limite, o painel pula a busca de apontamentos (TicketTask)
     * para nao bloquear o navegador. Cada ticket faz 1 request ao GLPI.
     * Com batch=12 paralelo, 1500 tickets levam ~25s na primeira carga
     * e depois ficam em cache TanStack Query por 5min.
     */
    maxTicketsForHours: 1500,
    presentationCarouselMs: 12_000,
    staleThresholdDays: parseStaleDays(env.VITE_STALE_DAYS as string | undefined),
  },
} as const;

export function isGLPIConfigured(): boolean {
  return Boolean(config.glpi.appToken && config.glpi.authBasic);
}
