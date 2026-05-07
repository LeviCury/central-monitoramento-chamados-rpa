/**
 * Filtros do dashboard com:
 * - Sincronização com URL (deep link compartilhável).
 * - Presets nomeados em localStorage.
 * - Seletor de grupo técnico.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterState, TicketType } from '../types';
import { config } from '../config';

const PRESETS_KEY = 'minerva-dashboard-presets-v1';
const GROUP_KEY = 'minerva-dashboard-group';

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
  groupId: string;
}

const EMPTY_FILTERS: FilterState = {
  dateRange: { start: '', end: '' },
  statuses: [],
  priorities: [],
  technicians: [],
  types: [],
};

const VALID_TYPES: TicketType[] = ['incident', 'request', 'unknown'];

function parseTypes(raw: string[]): TicketType[] {
  return raw
    .map(value => value.toLowerCase())
    .map(value => {
      if (value === 'incidente' || value === 'incident') return 'incident' as const;
      if (value === 'requisicao' || value === 'requisição' || value === 'request') return 'request' as const;
      if (value === 'unknown' || value === 'sem-tipo' || value === 'sem_tipo') return 'unknown' as const;
      return null;
    })
    .filter((v): v is TicketType => v !== null && VALID_TYPES.includes(v));
}

function serializeTypes(types: TicketType[]): string {
  return types
    .map(t => (t === 'incident' ? 'incidente' : t === 'request' ? 'requisicao' : 'sem-tipo'))
    .join(',');
}

function readUrlState(): { filters: FilterState; groupId: string | null } {
  if (typeof window === 'undefined') return { filters: EMPTY_FILTERS, groupId: null };
  const params = new URLSearchParams(window.location.search);
  const split = (key: string) =>
    (params.get(key) ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

  return {
    filters: {
      dateRange: {
        start: params.get('start') ?? '',
        end: params.get('end') ?? '',
      },
      statuses: split('status'),
      priorities: split('priority'),
      technicians: split('tech'),
      types: parseTypes(split('type')),
    },
    groupId: params.get('group'),
  };
}

function writeUrlState(filters: FilterState, groupId: string) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams();
  if (filters.dateRange.start) params.set('start', filters.dateRange.start);
  if (filters.dateRange.end) params.set('end', filters.dateRange.end);
  if (filters.statuses.length) params.set('status', filters.statuses.join(','));
  if (filters.priorities.length) params.set('priority', filters.priorities.join(','));
  if (filters.technicians.length) params.set('tech', filters.technicians.join(','));
  if (filters.types.length) params.set('type', serializeTypes(filters.types));
  if (groupId && groupId !== config.glpi.defaultGroupId) params.set('group', groupId);

  const queryString = params.toString();
  const newUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`;
  window.history.replaceState({}, '', newUrl);
}

function loadPresets(): FilterPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FilterPreset[]) : [];
  } catch {
    return [];
  }
}

function savePresetsToStorage(presets: FilterPreset[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function loadGroup(): string {
  if (typeof window === 'undefined') return config.glpi.defaultGroupId;
  return window.localStorage.getItem(GROUP_KEY) ?? config.glpi.defaultGroupId;
}

function persistGroup(groupId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GROUP_KEY, groupId);
}

export function useDashboardFilters() {
  const initial = useMemo(() => {
    const fromUrl = readUrlState();
    return {
      filters: fromUrl.filters,
      groupId: fromUrl.groupId ?? loadGroup(),
    };
  }, []);

  const [filters, setFilters] = useState<FilterState>(initial.filters);
  const [groupId, setGroupIdState] = useState<string>(initial.groupId);
  const [presets, setPresets] = useState<FilterPreset[]>(() => loadPresets());

  useEffect(() => {
    writeUrlState(filters, groupId);
  }, [filters, groupId]);

  useEffect(() => {
    persistGroup(groupId);
  }, [groupId]);

  const setGroupId = useCallback((id: string) => setGroupIdState(id), []);

  const reset = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const savePreset = useCallback(
    (name: string) => {
      if (!name.trim()) return;
      const preset: FilterPreset = {
        id: `${Date.now()}`,
        name: name.trim(),
        filters,
        groupId,
      };
      setPresets(prev => {
        const next = [...prev, preset];
        savePresetsToStorage(next);
        return next;
      });
    },
    [filters, groupId]
  );

  const applyPreset = useCallback((preset: FilterPreset) => {
    setFilters({
      ...EMPTY_FILTERS,
      ...preset.filters,
      types: preset.filters.types ?? [],
    });
    setGroupIdState(preset.groupId);
  }, []);

  const removePreset = useCallback((id: string) => {
    setPresets(prev => {
      const next = prev.filter(p => p.id !== id);
      savePresetsToStorage(next);
      return next;
    });
  }, []);

  return {
    filters,
    setFilters,
    groupId,
    setGroupId,
    presets,
    savePreset,
    applyPreset,
    removePreset,
    reset,
  };
}
