/**
 * Resolução de nomes de usuários do GLPI + allowlist de colaboradores RPA.
 *
 * - `userCache` em memória (id -> nome completo).
 * - Allowlist é construída a partir de `config.collaborators`, com tolerância
 *   a acentos, capitalização e espaços (normalizeName).
 */

import { config } from '../../config';
import { glpiFetch } from './session';
import { glpiUserSchema } from './schemas';

const userCache = new Map<string, string>();

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const ALLOWED_COLLABORATOR_MAP = new Map<string, string>(
  config.collaborators.flatMap(({ canonical, aliases }) => {
    const all = [canonical, ...aliases];
    return all.map(name => [normalizeName(name), canonical] as const);
  })
);

export const ALLOWED_COLLABORATORS = config.collaborators.map(c => c.canonical);

export function getAllowedCollaboratorName(name: string): string | null {
  return ALLOWED_COLLABORATOR_MAP.get(normalizeName(name)) ?? null;
}

export async function fetchUserName(userId: string): Promise<string> {
  if (userCache.has(userId)) {
    return userCache.get(userId)!;
  }
  if (!userId || userId === 'null' || userId === '0' || userId === '') {
    return 'Não atribuído';
  }

  try {
    const response = await glpiFetch(`/User/${userId}`);
    if (!response.ok) {
      console.warn(`[GLPI] Erro ao buscar usuário ${userId}:`, response.status);
      return `Técnico #${userId}`;
    }

    const json = await response.json();
    const parsed = glpiUserSchema.safeParse(json);
    if (!parsed.success) {
      console.warn(`[GLPI] Resposta inesperada para User/${userId}`);
      return `Técnico #${userId}`;
    }

    const data = parsed.data;
    const fullName =
      `${data.firstname ?? ''} ${data.realname ?? ''}`.trim() ||
      data.name ||
      `Técnico #${userId}`;

    userCache.set(userId, fullName);
    return fullName;
  } catch (error) {
    console.error(`[GLPI] Erro ao buscar usuário ${userId}:`, error);
    return `Técnico #${userId}`;
  }
}

export async function fetchUserNames(userIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds)].filter(
    id => id && id !== 'null' && id !== '0' && id !== '' && !userCache.has(id)
  );

  if (uniqueIds.length === 0) return userCache;

  const idsToFetch = uniqueIds.slice(0, 30);
  const batchSize = 5;
  for (let i = 0; i < idsToFetch.length; i += batchSize) {
    const batch = idsToFetch.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(id => fetchUserName(id)));
    if (i + batchSize < idsToFetch.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  return userCache;
}

export function getUserCache(): Map<string, string> {
  return userCache;
}
