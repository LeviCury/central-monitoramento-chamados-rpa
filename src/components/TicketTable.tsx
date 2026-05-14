import { Ticket, TicketType } from '../types';
import {
  AlarmClock,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileText,
  ListFilter,
  Maximize2,
  Minimize2,
  Search,
  Tag,
  X,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../contexts/useTheme';
import { formatHoursMinutes } from '../utils/timeFormat';
import { getStaleInfo } from '../services/analytics';

type Density = 'comfortable' | 'compact';

interface TicketTableProps {
  tickets: Ticket[];
  onSelectTicket: (ticket: Ticket) => void;
}

const GLPI_BASE_URL = 'https://central.minervafoods.com/front/ticket.form.php?id=';

// Stripe lateral colorido por status (acompanha cor do badge)
const STATUS_STRIPE: Record<string, string> = {
  Fechado: 'bg-emerald-500',
  Solucionado: 'bg-sky-500',
  Novo: 'bg-violet-500',
  'Em Atendimento (atribuído)': 'bg-minerva-red',
  'Em Atendimento (planejado)': 'bg-amber-500',
  Pendente: 'bg-rose-500',
};

const STATUS_STYLES_LIGHT: Record<string, string> = {
  Fechado: 'bg-emerald-500/10 text-emerald-700',
  Solucionado: 'bg-sky-500/10 text-sky-700',
  Novo: 'bg-violet-500/10 text-violet-700',
  'Em Atendimento (atribuído)': 'bg-rose-500/10 text-rose-700',
  'Em Atendimento (planejado)': 'bg-amber-500/10 text-amber-700',
  Pendente: 'bg-rose-500/10 text-rose-700',
};

const STATUS_STYLES_DARK: Record<string, string> = {
  Fechado: 'bg-emerald-500/15 text-emerald-300',
  Solucionado: 'bg-sky-500/15 text-sky-300',
  Novo: 'bg-violet-500/15 text-violet-300',
  'Em Atendimento (atribuído)': 'bg-rose-500/15 text-rose-300',
  'Em Atendimento (planejado)': 'bg-amber-500/15 text-amber-300',
  Pendente: 'bg-rose-500/15 text-rose-300',
};

const STATUS_DOTS: Record<string, string> = {
  Fechado: 'bg-emerald-500',
  Solucionado: 'bg-sky-500',
  Novo: 'bg-violet-500',
  'Em Atendimento (atribuído)': 'bg-minerva-red',
  'Em Atendimento (planejado)': 'bg-amber-500',
  Pendente: 'bg-rose-500',
};

const TYPE_STYLES_LIGHT: Record<TicketType, string> = {
  incident: 'bg-rose-500/10 text-rose-700',
  request: 'bg-sky-500/10 text-sky-700',
  unknown: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]',
};

const TYPE_STYLES_DARK: Record<TicketType, string> = {
  incident: 'bg-rose-500/15 text-rose-300',
  request: 'bg-sky-500/15 text-sky-300',
  unknown: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]',
};

const TYPE_DOTS: Record<TicketType, string> = {
  incident: 'bg-rose-500',
  request: 'bg-sky-500',
  unknown: 'bg-slate-400',
};

const TYPE_LABEL: Record<TicketType, string> = {
  incident: 'Incidente',
  request: 'Requisição',
  unknown: 'Sem tipo',
};

// Avatar circular gradient com iniciais.
const AVATAR_GRADIENTS = [
  'from-rose-400 to-rose-600',
  'from-amber-400 to-amber-600',
  'from-emerald-400 to-emerald-600',
  'from-sky-400 to-sky-600',
  'from-violet-400 to-violet-600',
  'from-fuchsia-400 to-fuchsia-600',
  'from-teal-400 to-teal-600',
  'from-orange-400 to-orange-600',
];

function avatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

type SortKey =
  | 'id'
  | 'title'
  | 'type'
  | 'status'
  | 'technician'
  | 'planned'
  | 'realized'
  | 'legacy'
  | 'opened';

type SortDir = 'asc' | 'desc';

interface SortState {
  key: SortKey;
  dir: SortDir;
}

const COLUMNS: { key: SortKey; label: string; align?: 'left' | 'center' }[] = [
  { key: 'id', label: 'ID', align: 'left' },
  { key: 'title', label: 'Título', align: 'left' },
  { key: 'type', label: 'Tipo', align: 'left' },
  { key: 'status', label: 'Status', align: 'left' },
  { key: 'technician', label: 'Técnico', align: 'left' },
  { key: 'planned', label: 'Planejado', align: 'center' },
  { key: 'realized', label: 'Realizado', align: 'center' },
  { key: 'legacy', label: 'Legado', align: 'center' },
  { key: 'opened', label: 'Aberto em', align: 'left' },
];

function getSortValue(ticket: Ticket, key: SortKey): string | number {
  switch (key) {
    case 'id':
      return Number(ticket.id) || 0;
    case 'title':
      return ticket.title?.toLowerCase() ?? '';
    case 'type':
      return ticket.type === 'incident' ? 0 : ticket.type === 'request' ? 1 : 2;
    case 'status':
      return ticket.status?.toLowerCase() ?? '';
    case 'technician':
      return ticket.assigned_technician?.toLowerCase() ?? '';
    case 'planned':
      return ticket.planned_time_hours || 0;
    case 'realized':
      return ticket.realized_time_hours || 0;
    case 'legacy':
      return ticket.legacy_time_hours || 0;
    case 'opened':
      return new Date(ticket.opened_date || ticket.created_at).getTime();
  }
}

// ---------------------------------------------------------------------------
// Filtro de coluna estilo Excel (escopo local da tabela — não afeta o resto do app)
// ---------------------------------------------------------------------------

type FilterableKey = 'type' | 'status' | 'technician';

const FILTERABLE_KEYS: ReadonlySet<FilterableKey> = new Set([
  'type',
  'status',
  'technician',
]);

interface ColumnFilters {
  type: Set<string>;
  status: Set<string>;
  technician: Set<string>;
}

function emptyColumnFilters(): ColumnFilters {
  return { type: new Set(), status: new Set(), technician: new Set() };
}

/**
 * Valor canônico da célula usado pelo filtro. Padroniza:
 *   - tipo: usa o label legível em pt-BR (Incidente / Requisição / Sem tipo)
 *   - status: usa o status bruto do GLPI (já vem em pt-BR)
 *   - técnico: usa o nome formatado (com fallback "Não atribuído")
 */
function getFilterValue(ticket: Ticket, key: FilterableKey): string {
  if (key === 'type') return TYPE_LABEL[ticket.type];
  if (key === 'status') return ticket.status || 'Sem status';
  // technician
  const raw = ticket.assigned_technician;
  if (!raw || raw === 'null' || raw === 'undefined') return 'Não atribuído';
  if (raw.includes(',')) {
    const parts = raw.split(',').map(p => p.trim());
    return `${parts[1]} ${parts[0]}`;
  }
  return raw;
}

/** Valores únicos disponíveis para filtrar uma coluna, ordenados pt-BR. */
function getDistinctFilterValues(tickets: Ticket[], key: FilterableKey): string[] {
  const set = new Set<string>();
  for (const t of tickets) set.add(getFilterValue(t, key));
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export default function TicketTable({ tickets, onSelectTicket }: TicketTableProps) {
  const { isDark } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: 'opened', dir: 'desc' });
  const [density, setDensity] = useState<Density>('comfortable');
  const itemsPerPage = 15;

  // Filtros de coluna estilo Excel (escopo local — não vaza pro Dashboard).
  // Set vazio = sem filtro (mostra todos). Set com valores = mostra só esses.
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>(emptyColumnFilters);
  const [openFilterKey, setOpenFilterKey] = useState<FilterableKey | null>(null);
  // Coords (viewport) do botão de filtro clicado, pra ancorar o popover via portal
  const [popoverAnchor, setPopoverAnchor] = useState<{ x: number; y: number; w: number } | null>(
    null
  );

  const getStatusBadgeStyle = (status: string) => {
    const styles = isDark ? STATUS_STYLES_DARK : STATUS_STYLES_LIGHT;
    const fallback = 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]';
    return styles[status] ?? fallback;
  };

  const getStatusDot = (status: string) => STATUS_DOTS[status] ?? 'bg-slate-400';
  const getStatusStripe = (status: string) => STATUS_STRIPE[status] ?? 'bg-slate-400';

  const getTypeBadgeStyle = (type: TicketType) =>
    (isDark ? TYPE_STYLES_DARK : TYPE_STYLES_LIGHT)[type];

  const searchFiltered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return tickets.filter(
      t =>
        t.title.toLowerCase().includes(term) ||
        t.id.toLowerCase().includes(term) ||
        t.assigned_technician?.toLowerCase().includes(term)
    );
  }, [tickets, searchTerm]);

  // Aplica os filtros de coluna (Set vazio = nenhuma restrição)
  const columnFiltered = useMemo(() => {
    const tipoActive = columnFilters.type.size > 0;
    const statusActive = columnFilters.status.size > 0;
    const techActive = columnFilters.technician.size > 0;
    if (!tipoActive && !statusActive && !techActive) return searchFiltered;
    return searchFiltered.filter(t => {
      if (tipoActive && !columnFilters.type.has(getFilterValue(t, 'type'))) return false;
      if (statusActive && !columnFilters.status.has(getFilterValue(t, 'status'))) return false;
      if (techActive && !columnFilters.technician.has(getFilterValue(t, 'technician'))) return false;
      return true;
    });
  }, [searchFiltered, columnFilters]);

  const sorted = useMemo(() => {
    const arr = [...columnFiltered];
    arr.sort((a, b) => {
      const av = getSortValue(a, sort.key);
      const bv = getSortValue(b, sort.key);
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [columnFiltered, sort]);

  // Resetar pra primeira página quando o conjunto filtrado muda de tamanho
  useEffect(() => {
    setCurrentPage(1);
  }, [columnFilters]);

  // Opções disponíveis no menu vêm do conjunto JÁ filtrado pelo search,
  // mas IGNORANDO o próprio column filter (estilo Excel: vê-se todas as
  // opções da fonte mesmo enquanto outras estão deselecionadas).
  const availableFilterValues = useMemo<Record<FilterableKey, string[]>>(
    () => ({
      type: getDistinctFilterValues(searchFiltered, 'type'),
      status: getDistinctFilterValues(searchFiltered, 'status'),
      technician: getDistinctFilterValues(searchFiltered, 'technician'),
    }),
    [searchFiltered]
  );

  const totalActiveFilters =
    columnFilters.type.size + columnFilters.status.size + columnFilters.technician.size;

  const handleToggleFilterValue = (key: FilterableKey, value: string) => {
    setColumnFilters(prev => {
      const next = { ...prev, [key]: new Set(prev[key]) };
      if (next[key].has(value)) next[key].delete(value);
      else next[key].add(value);
      return next;
    });
  };

  const handleClearFilter = (key: FilterableKey) => {
    setColumnFilters(prev => ({ ...prev, [key]: new Set<string>() }));
  };

  const handleSelectAllFilter = (key: FilterableKey) => {
    setColumnFilters(prev => ({
      ...prev,
      [key]: new Set(availableFilterValues[key]),
    }));
  };

  const handleClearAllFilters = () => setColumnFilters(emptyColumnFilters);

  const handleOpenFilter = (key: FilterableKey, evt: React.MouseEvent<HTMLButtonElement>) => {
    if (openFilterKey === key) {
      setOpenFilterKey(null);
      setPopoverAnchor(null);
      return;
    }
    const rect = evt.currentTarget.getBoundingClientRect();
    setPopoverAnchor({ x: rect.left, y: rect.bottom, w: rect.width });
    setOpenFilterKey(key);
  };

  const handleCloseFilter = () => {
    setOpenFilterKey(null);
    setPopoverAnchor(null);
  };

  const totalPages = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayed = sorted.slice(startIndex, startIndex + itemsPerPage);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTechnicianName = (name: string | undefined) => {
    if (!name || name === 'null' || name === 'undefined') return 'Não atribuído';
    if (/^\d+$/.test(name)) return `Técnico #${name}`;
    if (name.includes(',')) {
      const parts = name.split(',').map(p => p.trim());
      return `${parts[1]} ${parts[0]}`;
    }
    return name;
  };

  const technicianInitials = (displayName: string) => {
    if (!displayName || displayName === 'Não atribuído') return '?';
    const parts = displayName.trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
  };

  const getHoursWarning = (ticket: Ticket) => {
    if (ticket.hours_status === 'missing_planned') return 'Falta planejado';
    if (ticket.hours_status === 'missing_realized') return 'Falta realizado';
    if (ticket.hours_status === 'missing_both') return 'Faltam apontamentos';
    if (ticket.hours_status === 'legacy') return 'Legado';
    return null;
  };

  const handleSort = (key: SortKey) => {
    setSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
    setCurrentPage(1);
  };

  const cellPad = density === 'compact' ? 'py-2.5 px-4' : 'py-4 px-5';

  return (
    <div className="surface-elevated rounded-3xl overflow-hidden">
      {/* Header neutro, Apple-style */}
      <div className="px-7 pt-6 pb-5 border-b border-[var(--border-subtle)]">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)] shrink-0 mt-0.5">
              <FileText className="w-4 h-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)] tracking-[-0.01em]">
                Lista de Chamados
              </h2>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                <span className="font-semibold text-[var(--text-secondary)] tnum">
                  {sorted.length.toLocaleString('pt-BR')}
                </span>{' '}
                chamado{sorted.length === 1 ? '' : 's'} encontrado{sorted.length === 1 ? '' : 's'}
                {searchTerm && (
                  <>
                    {' · '}
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-2"
                    >
                      limpar busca
                    </button>
                  </>
                )}
                {totalActiveFilters > 0 && (
                  <>
                    {' · '}
                    <button
                      type="button"
                      onClick={handleClearAllFilters}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-2"
                    >
                      limpar filtros ({totalActiveFilters})
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div
              role="radiogroup"
              aria-label="Densidade da tabela"
              className="inline-flex items-center p-0.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
            >
              <button
                type="button"
                role="radio"
                aria-checked={density === 'comfortable'}
                onClick={() => setDensity('comfortable')}
                title="Confortável"
                className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
                  density === 'comfortable'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-subtle'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" aria-hidden />
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={density === 'compact'}
                onClick={() => setDensity('compact')}
                title="Compacto"
                className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
                  density === 'compact'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-subtle'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Minimize2 className="w-3.5 h-3.5" aria-hidden />
              </button>
            </div>

            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]"
                aria-hidden
              />
              <input
                type="search"
                aria-label="Buscar chamados por ID, título ou técnico"
                placeholder="Buscar por ID, título ou técnico…"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full md:w-72 pl-9 pr-3 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring-color)] focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 glass-strong border-b border-[var(--border-subtle)]">
            <tr>
              <th className="w-1 p-0" aria-hidden />
              {COLUMNS.map(col => {
                const active = sort.key === col.key;
                const SortIcon = active
                  ? sort.dir === 'asc'
                    ? ArrowUp
                    : ArrowDown
                  : ArrowUpDown;
                const filterableKey: FilterableKey | null =
                  FILTERABLE_KEYS.has(col.key as FilterableKey)
                    ? (col.key as FilterableKey)
                    : null;
                const filterActive = filterableKey
                  ? columnFilters[filterableKey].size > 0
                  : false;
                const filterCount = filterableKey ? columnFilters[filterableKey].size : 0;
                const isFilterOpen = openFilterKey === filterableKey;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`text-${col.align ?? 'left'} ${cellPad} text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider-2`}
                  >
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        aria-sort={
                          active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                        }
                        className={`inline-flex items-center gap-1.5 transition-colors ${
                          active
                            ? 'text-[var(--text-primary)]'
                            : 'hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {col.label}
                        <SortIcon
                          className={`w-3 h-3 ${active ? '' : 'opacity-40'}`}
                          aria-hidden
                        />
                      </button>
                      {filterableKey && (
                        <button
                          type="button"
                          onClick={evt => handleOpenFilter(filterableKey, evt)}
                          aria-label={`Filtrar por ${col.label}`}
                          aria-haspopup="dialog"
                          aria-expanded={isFilterOpen}
                          title={
                            filterActive
                              ? `Filtro ativo (${filterCount} selecionado${filterCount === 1 ? '' : 's'})`
                              : `Filtrar por ${col.label}`
                          }
                          className={`relative inline-flex items-center justify-center w-5 h-5 rounded-md transition-all ${
                            filterActive || isFilterOpen
                              ? 'bg-[var(--minerva-red)]/12 text-[var(--minerva-red)]'
                              : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <ListFilter className="w-3 h-3" aria-hidden />
                          {filterActive && (
                            <span
                              className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--minerva-red)] ring-2 ring-[var(--bg-elevated)]"
                              aria-hidden
                            />
                          )}
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
              <th
                scope="col"
                className={`text-center ${cellPad} text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider-2`}
              >
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {displayed.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length + 2}
                  className="py-20 text-center"
                >
                  <div className="flex flex-col items-center gap-5">
                    <img
                      src="/icons/empty-tickets.svg"
                      alt=""
                      className="w-24 h-24 opacity-60"
                      aria-hidden
                    />
                    <div>
                      <p className="text-base font-semibold text-[var(--text-primary)] tracking-[-0.01em]">
                        Nenhum chamado encontrado
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1.5 max-w-sm mx-auto">
                        {searchTerm
                          ? 'Tente outro termo de busca ou limpe os filtros.'
                          : 'Ajuste os filtros à esquerda para refinar a visualização.'}
                      </p>
                    </div>
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="ghost-btn"
                      >
                        Limpar busca
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              displayed.map(ticket => {
                const hoursWarning = getHoursWarning(ticket);
                const stale = getStaleInfo(ticket);
                const techDisplay = formatTechnicianName(ticket.assigned_technician);
                const isUnassigned = techDisplay === 'Não atribuído';
                const stripeClass = getStatusStripe(ticket.status);

                return (
                  <tr
                    key={ticket.id}
                    className="group relative hover:bg-[var(--bg-subtle)] transition-colors"
                  >
                    <td className="w-1 p-0 relative">
                      <span
                        className={`absolute inset-y-2 left-0 w-0.5 rounded-r-full ${stripeClass} opacity-0 group-hover:opacity-100 transition-opacity`}
                        aria-hidden
                      />
                    </td>

                    <td className={cellPad}>
                      <span className="font-mono text-[11px] text-[var(--text-secondary)] font-semibold tnum whitespace-nowrap">
                        #{ticket.id}
                      </span>
                    </td>

                    <td className={cellPad}>
                      <a
                        href={`${GLPI_BASE_URL}${ticket.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--text-primary)] hover:underline underline-offset-2 font-medium transition-colors flex items-start gap-2 max-w-xl"
                        title={ticket.title}
                      >
                        <span className="line-clamp-2 leading-snug">{ticket.title}</span>
                        <ExternalLink
                          className="w-3 h-3 mt-1 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0"
                          aria-hidden
                        />
                      </a>
                    </td>

                    <td className={cellPad}>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-md whitespace-nowrap ${getTypeBadgeStyle(ticket.type)}`}
                        title={
                          ticket.type === 'incident'
                            ? 'Incidente — algo quebrou na operação'
                            : ticket.type === 'request'
                              ? 'Requisição — solicitação, melhoria ou projeto'
                              : 'Tipo não definido no GLPI'
                        }
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${TYPE_DOTS[ticket.type]}`}
                          aria-hidden
                        />
                        {TYPE_LABEL[ticket.type]}
                      </span>
                    </td>

                    <td className={cellPad}>
                      <div className="flex flex-col gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-md w-fit ${getStatusBadgeStyle(ticket.status)}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${getStatusDot(ticket.status)}`}
                            aria-hidden
                          />
                          {ticket.status}
                        </span>
                        {stale.isStale && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 font-medium"
                            title={`Em aberto há ${Math.floor(stale.daysOpen)} dias`}
                          >
                            <AlarmClock className="w-3 h-3" aria-hidden />
                            Aberto há {Math.floor(stale.daysOpen)}d
                          </span>
                        )}
                        {hoursWarning && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3 h-3" aria-hidden />
                            {hoursWarning}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className={cellPad}>
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-semibold text-white shrink-0 ${
                            isUnassigned
                              ? 'bg-[var(--bg-subtle)] text-[var(--text-tertiary)]'
                              : `bg-gradient-to-br ${avatarGradient(techDisplay)}`
                          }`}
                          aria-hidden
                        >
                          {technicianInitials(techDisplay)}
                        </span>
                        <span
                          className={`text-[13px] ${
                            isUnassigned
                              ? 'italic text-[var(--text-tertiary)]'
                              : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {techDisplay}
                        </span>
                      </div>
                    </td>

                    <td className={`${cellPad} text-center`}>
                      <span
                        className={`text-[13px] font-medium tnum ${
                          ticket.planned_time_hours > 0
                            ? 'text-[var(--text-primary)]'
                            : 'text-[var(--text-tertiary)] opacity-50'
                        }`}
                      >
                        {formatHoursMinutes(ticket.planned_time_hours)}
                      </span>
                    </td>
                    <td className={`${cellPad} text-center`}>
                      <span
                        className={`text-[13px] font-medium tnum ${
                          ticket.realized_time_hours > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-[var(--text-tertiary)] opacity-50'
                        }`}
                      >
                        {formatHoursMinutes(ticket.realized_time_hours)}
                      </span>
                    </td>
                    <td className={`${cellPad} text-center`}>
                      <span
                        className={`text-[13px] font-medium tnum ${
                          ticket.legacy_time_hours > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-[var(--text-tertiary)] opacity-50'
                        }`}
                      >
                        {formatHoursMinutes(ticket.legacy_time_hours)}
                      </span>
                    </td>

                    <td className={cellPad}>
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <Calendar className="w-3 h-3 opacity-40" aria-hidden />
                        <div className="flex flex-col leading-tight">
                          <span className="font-medium tnum">
                            {formatDate(ticket.created_at)}
                          </span>
                          <span className="text-[10px] tnum text-[var(--text-tertiary)]">
                            {formatTime(ticket.created_at)}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className={cellPad}>
                      <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onSelectTicket(ticket)}
                          aria-label={`Ver detalhes do chamado ${ticket.id}`}
                          className="inline-flex items-center justify-center w-7 h-7 bg-[var(--bg-subtle)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-elevated)] text-[var(--text-secondary)] rounded-lg transition-all"
                          title="Ver detalhes"
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden />
                        </button>
                        <a
                          href={`${GLPI_BASE_URL}${ticket.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Abrir chamado ${ticket.id} no GLPI`}
                          className="inline-flex items-center justify-center w-7 h-7 bg-[var(--bg-subtle)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-elevated)] text-[var(--text-secondary)] rounded-lg transition-all"
                          title="Abrir no GLPI"
                        >
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-7 py-4 border-t border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-tertiary)]">
          {totalPages > 1 && (
            <p>
              Mostrando{' '}
              <span className="font-semibold text-[var(--text-primary)] tnum">
                {startIndex + 1}
              </span>
              –
              <span className="font-semibold text-[var(--text-primary)] tnum">
                {Math.min(startIndex + itemsPerPage, sorted.length)}
              </span>{' '}
              de{' '}
              <span className="font-semibold text-[var(--text-primary)] tnum">
                {sorted.length}
              </span>
            </p>
          )}
          <div className="hidden md:flex items-center gap-2 text-[var(--text-tertiary)]">
            <Tag className="w-3 h-3 opacity-50" aria-hidden />
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden />
              Incidente
            </span>
            <span className="opacity-40">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" aria-hidden />
              Requisição
            </span>
          </div>
        </div>

        {openFilterKey && popoverAnchor && (
          <ColumnFilterPopover
            title={
              openFilterKey === 'type'
                ? 'Filtrar por Tipo'
                : openFilterKey === 'status'
                  ? 'Filtrar por Status'
                  : 'Filtrar por Técnico'
            }
            anchor={popoverAnchor}
            values={availableFilterValues[openFilterKey]}
            selected={columnFilters[openFilterKey]}
            isDark={isDark}
            onToggle={value => handleToggleFilterValue(openFilterKey, value)}
            onSelectAll={() => handleSelectAllFilter(openFilterKey)}
            onClear={() => handleClearFilter(openFilterKey)}
            onClose={handleCloseFilter}
            renderValue={value => {
              if (openFilterKey === 'type') {
                const dotKey: TicketType =
                  value === 'Incidente' ? 'incident' : value === 'Requisição' ? 'request' : 'unknown';
                return (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${TYPE_DOTS[dotKey]}`}
                      aria-hidden
                    />
                    {value}
                  </span>
                );
              }
              if (openFilterKey === 'status') {
                return (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[value] ?? 'bg-slate-400'}`}
                      aria-hidden
                    />
                    {value}
                  </span>
                );
              }
              return <span>{value}</span>;
            }}
          />
        )}

        {totalPages > 1 && (
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="Página anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) pageNum = i + 1;
              else if (currentPage <= 3) pageNum = i + 1;
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = currentPage - 2 + i;
              const isCurrent = currentPage === pageNum;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`min-w-[1.75rem] h-7 px-2 rounded-lg text-xs font-semibold tnum transition-all ${
                    isCurrent
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-subtle'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="Próxima página"
            >
              <ChevronRight className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Popover do filtro estilo Excel (renderizado em portal)
// ---------------------------------------------------------------------------

interface ColumnFilterPopoverProps {
  title: string;
  anchor: { x: number; y: number; w: number };
  values: string[];
  selected: Set<string>;
  isDark: boolean;
  onToggle: (value: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onClose: () => void;
  renderValue?: (value: string) => React.ReactNode;
}

const POPOVER_WIDTH = 280;
const POPOVER_MAX_HEIGHT = 360;

function ColumnFilterPopover({
  title,
  anchor,
  values,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  onClose,
  renderValue,
}: ColumnFilterPopoverProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: anchor.x,
    top: anchor.y + 6,
  });

  // Reposiciona pra caber dentro do viewport
  useLayoutEffect(() => {
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchor.x;
    let top = anchor.y + 6;
    if (left + POPOVER_WIDTH + margin > vw) left = Math.max(margin, vw - POPOVER_WIDTH - margin);
    if (left < margin) left = margin;
    if (top + POPOVER_MAX_HEIGHT + margin > vh) {
      // Tenta abrir pra cima do botão se não couber pra baixo
      const upTop = anchor.y - 6 - POPOVER_MAX_HEIGHT - anchor.w * 0; // anchor.w não importa aqui
      top = Math.max(margin, upTop);
    }
    setPos({ left, top });
  }, [anchor]);

  // Click outside + ESC fecham o popover
  useEffect(() => {
    const handlePointer = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Pequeno delay pra evitar fechar com o mesmo click que abriu
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', handlePointer);
    }, 0);
    document.addEventListener('keydown', handleKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const filteredValues = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return values;
    return values.filter(v => v.toLowerCase().includes(term));
  }, [values, search]);

  const allSelected = values.length > 0 && values.every(v => selected.has(v));
  const noneSelected = selected.size === 0;

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-label={title}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        width: POPOVER_WIDTH,
        maxHeight: POPOVER_MAX_HEIGHT,
        zIndex: 60,
      }}
      className="surface-elevated rounded-2xl border border-[var(--border-default)] shadow-lifted flex flex-col overflow-hidden ticket-filter-popover"
    >
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[var(--border-subtle)]">
        <span className="text-[11px] font-semibold uppercase tracking-wider-2 text-[var(--text-tertiary)]">
          {title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar filtro"
          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
        >
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>

      <div className="px-3 pt-2.5 pb-2 border-b border-[var(--border-subtle)]">
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar valor…"
            aria-label="Buscar valor para filtrar"
            autoFocus
            className="w-full pl-8 pr-2.5 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-lg text-[12.5px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-color)] focus:border-transparent transition-all"
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[11px]">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={allSelected}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Selecionar todos
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={noneSelected}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Limpar
          </button>
        </div>
      </div>

      <div className="overflow-y-auto py-1.5 flex-1">
        {filteredValues.length === 0 ? (
          <div className="px-3.5 py-6 text-center">
            <p className="text-xs text-[var(--text-tertiary)]">Nenhum valor encontrado</p>
          </div>
        ) : (
          <ul role="listbox" aria-multiselectable="true" className="px-1">
            {filteredValues.map(value => {
              const isChecked = selected.has(value);
              return (
                <li key={value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isChecked}
                    onClick={() => onToggle(value)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
                  >
                    <span
                      className={`flex items-center justify-center w-4 h-4 rounded border transition-all shrink-0 ${
                        isChecked
                          ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-elevated)]'
                          : 'bg-transparent border-[var(--border-strong)]'
                      }`}
                      aria-hidden
                    >
                      {isChecked && <Check className="w-3 h-3" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 truncate">
                      {renderValue ? renderValue(value) : value}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="px-3.5 py-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-tertiary)] tnum">
        {selected.size === 0 ? (
          <>Sem filtro ativo · {values.length} valor{values.length === 1 ? '' : 'es'}</>
        ) : (
          <>
            <span className="font-semibold text-[var(--text-secondary)]">{selected.size}</span>{' '}
            de {values.length} selecionado{selected.size === 1 ? '' : 's'}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
