import { Ticket, TicketType } from '../types';
import {
  AlarmClock,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileText,
  Maximize2,
  Minimize2,
  Search,
  Tag,
} from 'lucide-react';
import { useMemo, useState } from 'react';
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

export default function TicketTable({ tickets, onSelectTicket }: TicketTableProps) {
  const { isDark } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: 'opened', dir: 'desc' });
  const [density, setDensity] = useState<Density>('comfortable');
  const itemsPerPage = 15;

  const getStatusBadgeStyle = (status: string) => {
    const styles = isDark ? STATUS_STYLES_DARK : STATUS_STYLES_LIGHT;
    const fallback = 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]';
    return styles[status] ?? fallback;
  };

  const getStatusDot = (status: string) => STATUS_DOTS[status] ?? 'bg-slate-400';
  const getStatusStripe = (status: string) => STATUS_STRIPE[status] ?? 'bg-slate-400';

  const getTypeBadgeStyle = (type: TicketType) =>
    (isDark ? TYPE_STYLES_DARK : TYPE_STYLES_LIGHT)[type];

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return tickets.filter(
      t =>
        t.title.toLowerCase().includes(term) ||
        t.id.toLowerCase().includes(term) ||
        t.assigned_technician?.toLowerCase().includes(term)
    );
  }, [tickets, searchTerm]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = getSortValue(a, sort.key);
      const bv = getSortValue(b, sort.key);
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

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
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`text-${col.align ?? 'left'} ${cellPad} text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider-2`}
                  >
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
