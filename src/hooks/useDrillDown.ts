/**
 * Helpers de drill-down: cliques em barras/áreas dos gráficos
 * disparam alterações de filtro no Dashboard.
 */
import { useCallback } from 'react';
import { FilterState } from '../types';

export function useDrillDown(
  filters: FilterState,
  setFilters: (next: FilterState) => void
) {
  const drillStatus = useCallback(
    (status: string) => {
      const has = filters.statuses.includes(status);
      setFilters({
        ...filters,
        statuses: has ? filters.statuses.filter(s => s !== status) : [status],
      });
    },
    [filters, setFilters]
  );

  const drillTechnician = useCallback(
    (technician: string) => {
      const has = filters.technicians.includes(technician);
      setFilters({
        ...filters,
        technicians: has ? filters.technicians.filter(t => t !== technician) : [technician],
      });
    },
    [filters, setFilters]
  );

  const drillDate = useCallback(
    (date: string) => {
      setFilters({
        ...filters,
        dateRange: { start: date, end: date },
      });
    },
    [filters, setFilters]
  );

  return { drillStatus, drillTechnician, drillDate };
}
