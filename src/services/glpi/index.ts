/**
 * Barrel do módulo GLPI: re-exporta a API pública usada pelo restante da app.
 */

export { fetchTicketsFromGLPI, type GLPISearchParams } from './tickets';
export {
  fetchTicketTaskEntries,
  fetchMultipleTicketTaskEntries,
  clearTicketTaskCache,
} from './tasks';
export {
  fetchUserName,
  fetchUserNames,
  ALLOWED_COLLABORATORS,
  getAllowedCollaboratorName,
} from './users';
export {
  getValidSessionToken,
  invalidateSession,
  killSession,
  glpiFetch,
} from './session';
export { GLPI_FIELDS, STATUS_MAP, PRIORITY_MAP } from './constants';
export { isGLPIConfigured } from '../../config';
