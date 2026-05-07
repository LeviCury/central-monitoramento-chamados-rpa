/**
 * Hook principal de dados: usa TanStack Query para buscar tickets do GLPI,
 * carregar horas trabalhadas e expor o estado de loading/erro/refetch.
 *
 * Resolve race conditions automaticamente (a query mais recente vence) e
 * elimina loaders manuais espalhados no Dashboard.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { Ticket } from '../types';
import { config } from '../config';
import { fetchTickets, fetchWorkHoursForTickets } from '../services/analytics';
import { FilterState } from '../types';

export interface UseGLPITicketsOptions {
  filters: FilterState;
  groupId: string;
}

const TICKETS_KEY = 'glpi-tickets';
const HOURS_KEY = 'glpi-tickets-hours';

export function useGLPITickets({ filters, groupId }: UseGLPITicketsOptions) {
  const queryClient = useQueryClient();

  const ticketsQuery = useQuery({
    queryKey: [
      TICKETS_KEY,
      groupId,
      filters.dateRange.start,
      filters.dateRange.end,
      filters.statuses,
      filters.priorities,
      filters.technicians,
    ],
    queryFn: ({ signal }) =>
      fetchTickets({
        startDate: filters.dateRange.start || undefined,
        endDate: filters.dateRange.end || undefined,
        statuses: filters.statuses.length > 0 ? filters.statuses : undefined,
        priorities: filters.priorities.length > 0 ? filters.priorities : undefined,
        technicians: filters.technicians.length > 0 ? filters.technicians : undefined,
        groupId,
        signal,
      }),
    staleTime: 60_000,
    refetchInterval: config.ui.autoRefreshMinutes * 60 * 1000,
    refetchIntervalInBackground: false,
  });

  // Quando os tickets mudarem, dispara busca paralela das horas trabalhadas.
  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);
  const ticketIdsKey = useMemo(() => tickets.map(t => t.id).join(','), [tickets]);

  const hoursQuery = useQuery({
    queryKey: [HOURS_KEY, ticketIdsKey],
    queryFn: async () => {
      if (tickets.length === 0 || tickets.length > config.ui.maxTicketsForHours) {
        return tickets;
      }
      const updated = await fetchWorkHoursForTickets([...tickets]);
      return updated;
    },
    enabled: tickets.length > 0,
    staleTime: 5 * 60_000,
  });

  // Toda vez que ticketsQuery mudar, invalidamos a hours antiga.
  useEffect(() => {
    if (!ticketsQuery.isFetching) {
      queryClient.invalidateQueries({ queryKey: [HOURS_KEY], exact: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketsQuery.dataUpdatedAt]);

  const enrichedTickets: Ticket[] = hoursQuery.data ?? tickets;

  return {
    tickets: enrichedTickets,
    isLoading: ticketsQuery.isLoading,
    isFetching: ticketsQuery.isFetching,
    isLoadingHours: hoursQuery.isFetching && tickets.length > 0,
    isError: ticketsQuery.isError,
    error: ticketsQuery.error,
    lastUpdate: ticketsQuery.dataUpdatedAt
      ? new Date(ticketsQuery.dataUpdatedAt)
      : new Date(),
    refetch: () => {
      ticketsQuery.refetch();
      hoursQuery.refetch();
    },
  };
}
