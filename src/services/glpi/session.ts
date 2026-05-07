/**
 * Gerenciamento de sessão (token) na API do GLPI.
 *
 * - Cache em memória do `session_token` por `sessionDurationMs`.
 * - Renovação automática quando inválido / expirado.
 * - `invalidateSession()` é chamado externamente em respostas 401.
 */

import { config } from '../../config';
import { glpiSessionSchema } from './schemas';

let sessionToken: string | null = null;
let sessionExpiry = 0;
let sessionPromise: Promise<string> | null = null;

async function createSession(): Promise<string> {
  if (!config.glpi.appToken || !config.glpi.authBasic) {
    throw new Error(
      'Credenciais do GLPI ausentes. Verifique VITE_GLPI_AUTH_BASIC e VITE_GLPI_APP_TOKEN no .env.'
    );
  }

  console.log('[GLPI] Criando nova sessão...');

  let response: Response;
  try {
    response = await fetch(`${config.glpi.baseUrl}/initSession/`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${config.glpi.authBasic}`,
        'App-Token': config.glpi.appToken,
      },
    });
  } catch (err) {
    // Tipico TypeError: "Failed to fetch" — quase sempre uma destas tres causas
    // em produçao (Vercel + GLPI interno):
    //   1) Usuario fora da VPN/intranet → DNS/host inalcançavel
    //   2) Servidor GLPI nao devolve headers CORS para o origin atual
    //   3) Mixed content (HTTPS->HTTP)
    const baseUrl = config.glpi.baseUrl;
    const hint = config.isDev
      ? 'Verifique se o proxy do Vite esta ativo e se voce esta na VPN da Minerva.'
      : `Verifique:\n  - voce esta conectado a VPN/intranet da Minerva (o GLPI ${baseUrl} e interno);\n  - o servidor GLPI esta liberando CORS para a origem ${typeof window !== 'undefined' ? window.location.origin : '(desconhecida)'};\n  - veja docs/INFRA-CORS.md para o pedido tecnico ao TI.`;
    throw new Error(
      `Nao foi possivel alcançar o GLPI (${baseUrl}/initSession). ${hint}\n\nDetalhe: ${(err as Error).message}`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao criar sessão GLPI: ${response.status} - ${errorText}`
    );
  }

  const json = await response.json();
  const parsed = glpiSessionSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Resposta inesperada de /initSession: ${parsed.error.message}`
    );
  }

  sessionToken = parsed.data.session_token;
  sessionExpiry = Date.now() + config.glpi.sessionDurationMs;
  console.log('[GLPI] Sessão criada com sucesso');
  return sessionToken;
}

export async function getValidSessionToken(): Promise<string> {
  if (sessionToken && Date.now() < sessionExpiry) {
    return sessionToken;
  }

  // Evita race condition: várias chamadas concorrentes esperam a mesma promise.
  if (!sessionPromise) {
    sessionPromise = createSession().finally(() => {
      sessionPromise = null;
    });
  }
  return sessionPromise;
}

export function invalidateSession(): void {
  sessionToken = null;
  sessionExpiry = 0;
}

export async function killSession(): Promise<void> {
  if (!sessionToken) return;
  try {
    await fetch(`${config.glpi.baseUrl}/killSession/`, {
      method: 'GET',
      headers: {
        'Session-Token': sessionToken,
        'App-Token': config.glpi.appToken,
      },
    });
  } catch (error) {
    console.error('[GLPI] Erro ao encerrar sessão:', error);
  } finally {
    invalidateSession();
  }
}

/**
 * Wrapper de `fetch` que injeta os headers de sessão e renova
 * automaticamente o token em caso de 401.
 */
export async function glpiFetch(
  path: string,
  init: RequestInit = {},
  retried = false
): Promise<Response> {
  const token = await getValidSessionToken();
  const headers = new Headers(init.headers);
  headers.set('Session-Token', token);
  headers.set('App-Token', config.glpi.appToken);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${config.glpi.baseUrl}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && !retried) {
    invalidateSession();
    return glpiFetch(path, init, true);
  }
  return response;
}
