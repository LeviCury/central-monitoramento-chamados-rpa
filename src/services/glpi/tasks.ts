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

// ---------- diagnostico temporario ----------
// Imprime no console a estrutura das primeiras N tasks e o motivo
// de cada uma ter sido aceita ou rejeitada. Sem isso, "0h" fica
// sendo um buraco preto: nao da pra saber se e dado ausente,
// categoria errada ou colaborador fora da whitelist.
const TASK_DIAG_MAX = 8;
let taskDiagSamples = 0;
const taskDiagStats = {
  totalTasksSeen: 0,
  rejectedNoActionTime: 0,
  rejectedNoCollaborator: 0,
  acceptedPlanned: 0,
  acceptedRealized: 0,
  acceptedLegacy: 0,
  uniqueCategoryIds: new Set<number>(),
  uniqueUserIds: new Set<string>(),
  /**
   * Mapa de id -> nome resolvido para os colaboradores rejeitados.
   * Permite ver "quem sao essas pessoas" sem precisar abrir o GLPI.
   */
  rejectedCollaboratorNames: new Map<string, string>(),
};
function logTaskDiagSample(
  ticketId: string,
  rawTask: Record<string, unknown>,
  outcome: string,
  resolvedKind?: string,
  resolvedCollaborator?: string | null
) {
  if (taskDiagSamples >= TASK_DIAG_MAX) return;
  taskDiagSamples += 1;
  console.log(
    `[GLPI][diag] ticket=${ticketId} actiontime=${rawTask.actiontime} ` +
      `taskcategories_id=${rawTask.taskcategories_id} ` +
      `users_id=${rawTask.users_id ?? rawTask.users_id_tech ?? '-'} ` +
      `outcome=${outcome}` +
      (resolvedKind ? ` kind=${resolvedKind}` : '') +
      (resolvedCollaborator ? ` collaborator=${resolvedCollaborator}` : ''),
    rawTask
  );
}
function flushTaskDiagStats() {
  if (taskDiagStats.totalTasksSeen === 0) return;
  const rejectedNames = Array.from(taskDiagStats.rejectedCollaboratorNames.entries())
    .map(([id, name]) => `${name} (id=${id})`)
    .sort();
  // Imprime tudo em texto puro pra nao precisar expandir Object no DevTools
  console.log(
    '[GLPI][diag] === resumo de apontamentos ===\n' +
      `  totalTasksSeen: ${taskDiagStats.totalTasksSeen}\n` +
      `  rejectedNoActionTime: ${taskDiagStats.rejectedNoActionTime}\n` +
      `  rejectedNoCollaborator: ${taskDiagStats.rejectedNoCollaborator}\n` +
      `  acceptedPlanned:  ${taskDiagStats.acceptedPlanned}\n` +
      `  acceptedRealized: ${taskDiagStats.acceptedRealized}\n` +
      `  acceptedLegacy:   ${taskDiagStats.acceptedLegacy}\n` +
      `  uniqueCategoryIds: [${Array.from(taskDiagStats.uniqueCategoryIds)
        .sort((a, b) => a - b)
        .join(', ')}]\n` +
      `  uniqueUserIds (qtd=${taskDiagStats.uniqueUserIds.size}): [${Array.from(
        taskDiagStats.uniqueUserIds
      )
        .slice(0, 30)
        .join(', ')}]\n` +
      `  configuracao: planned=${config.glpi.plannedTaskCategoryId} realized=${config.glpi.realizedTaskCategoryId}\n` +
      `  colaboradoresPermitidos (qtd=${config.collaborators.length}): [${config.collaborators
        .map(c => c.canonical)
        .join(' | ')}]\n` +
      `  REJEITADOS POR WHITELIST (${rejectedNames.length}):\n` +
      (rejectedNames.length === 0 ? '    (nenhum)' : '    - ' + rejectedNames.join('\n    - '))
  );
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
  if (categoryId === config.glpi.plannedTaskCategoryId) return 'planned';
  if (categoryId === config.glpi.realizedTaskCategoryId) return 'realized';
  return 'legacy';
}

function getTaskUserId(task: Record<string, unknown>): string {
  const userId =
    task.users_id ?? task.users_id_tech ?? task.users_id_editor ?? task.user_id;
  return userId == null ? '' : String(userId);
}

interface TaskCollaboratorResolution {
  /** Nome canonico permitido pela whitelist (ou null se nao permitido). */
  collaborator: string | null;
  /** Nome real resolvido no GLPI, mesmo quando NAO permitido. Util pra log. */
  resolvedName: string;
}

async function resolveTaskCollaborator(
  task: Record<string, unknown>
): Promise<TaskCollaboratorResolution> {
  const taskUser = getTaskUserId(task);
  if (!taskUser) return { collaborator: null, resolvedName: '' };

  const directMatch = getAllowedCollaboratorName(taskUser);
  if (directMatch) return { collaborator: directMatch, resolvedName: directMatch };

  if (/^\d+$/.test(taskUser)) {
    const resolvedUser = await fetchUserName(taskUser);
    const allowed = getAllowedCollaboratorName(resolvedUser);
    return { collaborator: allowed, resolvedName: resolvedUser || `#${taskUser}` };
  }
  return { collaborator: null, resolvedName: taskUser };
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
      taskDiagStats.totalTasksSeen += 1;
      const rawCatId = toNumber(rawTask.taskcategories_id);
      if (rawCatId !== null) taskDiagStats.uniqueCategoryIds.add(rawCatId);
      const rawUserId = String(
        rawTask.users_id ?? rawTask.users_id_tech ?? rawTask.users_id_editor ?? ''
      );
      if (rawUserId) taskDiagStats.uniqueUserIds.add(rawUserId);

      const actionTime = toNumber(rawTask.actiontime);
      if (!actionTime || actionTime <= 0) {
        taskDiagStats.rejectedNoActionTime += 1;
        logTaskDiagSample(ticketId, rawTask, 'rejected:no_actiontime');
        continue;
      }

      const resolution = await resolveTaskCollaborator(rawTask);
      if (!resolution.collaborator) {
        taskDiagStats.rejectedNoCollaborator += 1;
        if (rawUserId) {
          taskDiagStats.rejectedCollaboratorNames.set(
            rawUserId,
            resolution.resolvedName || `(sem nome)`
          );
        }
        logTaskDiagSample(
          ticketId,
          rawTask,
          `rejected:collaborator_not_in_whitelist resolvedName="${resolution.resolvedName}"`
        );
        continue;
      }

      const categoryId = rawCatId;
      const taskId = rawTask.id ?? rawTask['2'] ?? `${ticketId}-${entries.length + 1}`;
      const taskDate = rawTask.date ?? rawTask.date_creation ?? rawTask.date_mod ?? null;
      const content = rawTask.content ?? rawTask.name ?? '';
      const hours = Math.round((actionTime / 3600) * 10) / 10;
      const kind = getTaskKind(categoryId);
      if (kind === 'planned') taskDiagStats.acceptedPlanned += 1;
      else if (kind === 'realized') taskDiagStats.acceptedRealized += 1;
      else taskDiagStats.acceptedLegacy += 1;

      logTaskDiagSample(ticketId, rawTask, 'accepted', kind, resolution.collaborator);

      entries.push({
        id: String(taskId),
        ticket_id: ticketId,
        collaborator: resolution.collaborator,
        category_id: categoryId,
        kind,
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

  const total = idsToFetch.length;
  const startedAt = performance.now();
  console.log(`[GLPI] Buscando apontamentos de ${total} tickets em paralelo (batch=12)...`);

  // 12 em paralelo sem delay artificial: balanço entre velocidade e
  // não saturar o GLPI. ~25s para 1500 tickets em rede normal.
  const batchSize = 12;
  let processed = 0;
  let nextLogAt = 100;

  for (let i = 0; i < idsToFetch.length; i += batchSize) {
    const batch = idsToFetch.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(id => fetchTicketTaskEntries(id)));
    processed += batch.length;
    if (processed >= nextLogAt) {
      const elapsed = ((performance.now() - startedAt) / 1000).toFixed(1);
      console.log(`[GLPI] Apontamentos: ${processed}/${total} (${elapsed}s)`);
      nextLogAt += 200;
    }
  }

  const totalElapsed = ((performance.now() - startedAt) / 1000).toFixed(1);
  console.log(`[GLPI] Apontamentos: ${total}/${total} concluido em ${totalElapsed}s`);
  flushTaskDiagStats();
  return ticketTaskCache;
}

export function clearTicketTaskCache(): void {
  ticketTaskCache.clear();
}
