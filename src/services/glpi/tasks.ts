/**
 * Buscas de TicketTask (apontamentos) e cálculo de horas planejadas/realizadas/legadas.
 *
 * Filtra somente apontamentos dos colaboradores RPA permitidos
 * (definidos via VITE_RPA_COLLABORATORS).
 */

import { config } from '../../config';
import { TicketTaskEntry, TicketTaskKind } from '../../types';
import { glpiFetch } from './session';
import { fetchUserName, getAllowedCollaboratorName } from './users';
import { glpiTicketTaskListSchema } from './schemas';

const ticketTaskCache = new Map<string, TicketTaskEntry[]>();

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function getTaskKind(categoryId: number | null): TicketTaskKind {
  if (categoryId === config.glpi.plannedTaskCategoryId) return 'planned';
  if (categoryId === config.glpi.realizedTaskCategoryId) return 'realized';
  return 'legacy';
}

function getTaskUserId(task: Record<string, unknown>): string {
  const userId =
    task.users_id ?? task.users_id_tech ?? task.users_id_editor ?? task.user_id;
  return userId == null ? '' : String(userId);
}

async function resolveTaskCollaborator(
  task: Record<string, unknown>
): Promise<string | null> {
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

export async function fetchTicketTaskEntries(
  ticketId: string
): Promise<TicketTaskEntry[]> {
  if (ticketTaskCache.has(ticketId)) return ticketTaskCache.get(ticketId)!;
  if (!ticketId || ticketId === 'null' || ticketId === '') return [];

  try {
    const response = await glpiFetch(`/Ticket/${ticketId}/TicketTask`);
    if (!response.ok) {
      ticketTaskCache.set(ticketId, []);
      return [];
    }

    const json = await response.json();
    const parsed = glpiTicketTaskListSchema.safeParse(json);
    if (!parsed.success) {
      ticketTaskCache.set(ticketId, []);
      return [];
    }

    const entries: TicketTaskEntry[] = [];

    for (const rawTask of parsed.data as Record<string, unknown>[]) {
      const actionTime = toNumber(rawTask.actiontime);
      if (!actionTime || actionTime <= 0) continue;

      const collaborator = await resolveTaskCollaborator(rawTask);
      if (!collaborator) continue;

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

export async function fetchMultipleTicketTaskEntries(
  ticketIds: string[]
): Promise<Map<string, TicketTaskEntry[]>> {
  const idsToFetch = ticketIds.filter(id => !ticketTaskCache.has(id));
  if (idsToFetch.length === 0) return ticketTaskCache;

  console.log(`[GLPI] Buscando apontamentos de ${idsToFetch.length} tickets...`);

  const batchSize = 5;
  for (let i = 0; i < idsToFetch.length; i += batchSize) {
    const batch = idsToFetch.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(id => fetchTicketTaskEntries(id)));
    if (i + batchSize < idsToFetch.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  return ticketTaskCache;
}

export function clearTicketTaskCache(): void {
  ticketTaskCache.clear();
}
