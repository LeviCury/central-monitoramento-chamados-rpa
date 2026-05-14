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

/**
 * Equipe RPA da Minerva — lista FIXA, hardcoded no código.
 *
 * Por que hardcoded em vez de depender 100% de `VITE_RPA_COLLABORATORS`?
 *   1. A equipe é estável e pequena (6 pessoas em maio/2026).
 *   2. Garante que em QUALQUER ambiente (dev local, Vercel, alguém clonando
 *      o repo amanhã) o painel vai filtrar corretamente — sem o silêncio
 *      desconcertante de "ué, apareceu CST_Luiz aqui no apontamento de
 *      horas, alguém da equipe RPA?".
 *   3. A env var continua suportada e tem PRECEDÊNCIA (ver `parseCollaborators`):
 *      basta definir `VITE_RPA_COLLABORATORS="A|B|C"` para sobrescrever.
 *
 * Para adicionar/remover alguém da equipe, EDITE ESTA LISTA.
 *
 * Aliases ajudam quando o nome no GLPI vem abreviado (ex.: "Igor Minuncio"
 * em vez de "Igor Martins Minuncio"). A normalização já é case-insensitive
 * e ignora acentos — só precisa de alias quando o GLPI omite parte do nome.
 */
const DEFAULT_RPA_COLLABORATORS: RpaCollaborator[] = [
  {
    canonical: 'Igor Martins Minuncio',
    aliases: ['Igor Minuncio', 'Igor Martins'],
  },
  {
    canonical: 'Levi Ribeiro Cury',
    aliases: ['Levi Cury', 'Levi Ribeiro'],
  },
  {
    canonical: 'Guilherme Bretanha Franco Fernandes',
    aliases: [
      'Guilherme Bretanha',
      'Guilherme Fernandes',
      'Guilherme Franco Fernandes',
    ],
  },
  {
    canonical: 'Daniel Eduardo Fernandes dos Santos',
    aliases: [
      'Daniel Fernandes',
      'Daniel Santos',
      'Daniel dos Santos',
      'Daniel Eduardo',
    ],
  },
  {
    canonical: 'Rodinei Ferraz',
    aliases: [],
  },
  {
    canonical: 'Carlos Henrique de Oliveira',
    aliases: ['Carlos Oliveira', 'Carlos Henrique'],
  },
];

function parseCollaborators(raw: string | undefined): RpaCollaborator[] {
  if (!raw || !raw.trim()) {
    // Sem env var: usa a lista default da equipe RPA.
    return DEFAULT_RPA_COLLABORATORS;
  }
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
  /** True quando a env var foi definida (sobrescreve o default). */
  collaboratorsFromEnv: Boolean(
    (env.VITE_RPA_COLLABORATORS as string | undefined)?.trim()
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

let configBannerLogged = false;
/**
 * Imprime UMA vez no console um resumo da config carregada.
 * Crucial em producao: se voce esquecer VITE_RPA_COLLABORATORS no
 * Vercel, este log mostra "WHITELIST: VAZIA" antes de o painel
 * comecar a parecer quebrado.
 */
export function logConfigBanner(): void {
  if (configBannerLogged) return;
  configBannerLogged = true;
  const collabs = config.collaborators.map(c => c.canonical);
  const lines = [
    '[config] === resumo da configuracao carregada ===',
    `  modo: ${isDev ? 'DEV (proxy /api/glpi)' : 'PROD (direto na URL publica do GLPI)'}`,
    `  glpi.baseUrl: ${config.glpi.baseUrl}`,
    `  glpi.entityId: ${config.glpi.entityId ?? '(nao filtrar)'}`,
    `  glpi.defaultGroupId: ${config.glpi.defaultGroupId}`,
    `  glpi.appToken: ${config.glpi.appToken ? 'OK' : 'AUSENTE !!'}`,
    `  glpi.authBasic: ${config.glpi.authBasic ? 'OK' : 'AUSENTE !!'}`,
    `  glpi.plannedCategoryId: ${config.glpi.plannedTaskCategoryId}`,
    `  glpi.realizedCategoryId: ${config.glpi.realizedTaskCategoryId}`,
    `  collaborators (whitelist): ${collabs.length} ${
      config.collaboratorsFromEnv ? '[via env VITE_RPA_COLLABORATORS]' : '[default RPA hardcoded]'
    } -> [${collabs.join(' | ')}]`,
    `  ui.maxTicketsForHours: ${config.ui.maxTicketsForHours}`,
    `  ui.staleThresholdDays: ${config.ui.staleThresholdDays}`,
  ];
  console.log(lines.join('\n'));
  if (collabs.length === 0) {
    // Improvavel ate aqui (default hardcoded), mas defensivo: alguem pode
    // ter passado VITE_RPA_COLLABORATORS="" (vazia mas presente).
    console.warn(
      '[config] Lista de colaboradores RPA esta VAZIA. ' +
        'O painel vai mostrar TODAS as horas de TODAS as pessoas que apontaram nos chamados. ' +
        'Verifique a env var VITE_RPA_COLLABORATORS ou o default em src/config.ts.'
    );
  }
}
