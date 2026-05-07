import { Ticket, TicketType } from '../types';
import {
  AlarmClock,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  ExternalLink,
  Eye,
  FileText,
  Search,
  Tag,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTheme } from '../contexts/useTheme';
import { formatHoursMinutes } from '../utils/timeFormat';
import { getStaleInfo } from '../services/analytics';

interface TicketTableProps {
  tickets: Ticket[];
  onSelectTicket: (ticket: Ticket) => void;
}

const GLPI_BASE_URL = 'https://central.minervafoods.com/front/ticket.form.php?id=';

// Status badges (light/dark)
const STATUS_STYLES_LIGHT: Record<string, string> = {
  Fechado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Solucionado: 'bg-blue-50 text-blue-700 border-blue-200',
  Novo: 'bg-violet-50 text-violet-700 border-violet-200',
  'Em Atendimento (atribuído)': 'bg-minerva-red/10 text-minerva-red border-minerva-red/30',
  'Em Atendimento (planejado)': 'bg-amber-50 text-amber-700 border-amber-200',
  Pendente: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_STYLES_DARK: Record<string, string> = {
  Fechado: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
  Solucionado: 'bg-blue-500/15 text-blue-200 border-blue-500/30',
  Novo: 'bg-violet-500/15 text-violet-200 border-violet-500/30',
  'Em Atendimento (atribuído)': 'bg-minerva-red/20 text-rose-200 border-minerva-red/40',
  'Em Atendimento (planejado)': 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  Pendente: 'bg-red-500/15 text-red-200 border-red-500/30',
};

// Dot colorido na frente do badge de status
const STATUS_DOTS: Record<string, string> = {
  Fechado: 'bg-emerald-500',
  Solucionado: 'bg-blue-500',
  Novo: 'bg-violet-500',
  'Em Atendimento (atribuído)': 'bg-minerva-red',
  'Em Atendimento (planejado)': 'bg-amber-500',
  Pendente: 'bg-red-500',
};

// Tipo: Incidente vs Requisição
const TYPE_STYLES_LIGHT: Record<TicketType, string> = {
  incident: 'bg-rose-50 text-rose-700 border-rose-200',
  request: 'bg-sky-50 text-sky-700 border-sky-200',
  unknown: 'bg-gray-100 text-gray-600 border-gray-200',
};

const TYPE_STYLES_DARK: Record<TicketType, string> = {
  incident: 'bg-rose-500/15 text-rose-200 border-rose-500/30',
  request: 'bg-sky-500/15 text-sky-200 border-sky-500/30',
  unknown: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

const TYPE_DOTS: Record<TicketType, string> = {
  incident: 'bg-rose-500',
  request: 'bg-sky-500',
  unknown: 'bg-gray-400',
};

const TYPE_LABEL: Record<TicketType, string> = {
  incident: 'Incidente',
  request: 'Requisição',
  unknown: 'Sem tipo',
};

// Avatar circular com a inicial — gera uma cor estável a partir do nome.
const AVATAR_PALETTE = [
  'bg-rose-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-teal-500',
  'bg-orange-500',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
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
      // Ordem natural: Incidente (0) → Requisição (1) → Sem tipo (2)
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
  const itemsPerPage = 15;

  const getStatusBadgeStyle = (status: string) => {
    const styles = isDark ? STATUS_STYLES_DARK : STATUS_STYLES_LIGHT;
    const fallback = isDark
      ? 'bg-gray-500/15 text-gray-300 border-gray-500/30'
      : 'bg-gray-100 text-gray-700 border-gray-200';
    return styles[status] ?? fallback;
  };

  const getStatusDot = (status: string) => STATUS_DOTS[status] ?? 'bg-gray-400';

  const getTypeBadgeStyle = (type: TicketType) => {
    const styles = isDark ? TYPE_STYLES_DARK : TYPE_STYLES_LIGHT;
    return styles[type];
  };

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
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', {
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

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-minerva overflow-hidden border border-gray-100 dark:border-slate-700">
      {/* Header com título, contador e busca */}
      <div className="px-6 py-5 bg-gradient-to-r from-minerva-navy to-minerva-navy-light">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <FileText className="w-5 h-5 text-white" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Lista de Chamados</h2>
              <p className="text-white/60 text-sm">
                {sorted.length.toLocaleString('pt-BR')} chamado{sorted.length === 1 ? '' : 's'} encontrado{sorted.length === 1 ? '' : 's'}
                {searchTerm && (
                  <>
                    {' · '}
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="underline underline-offset-2 hover:text-white"
                    >
                      limpar busca
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50"
              aria-hidden
            />
            <input
              type="search"
              aria-label="Buscar chamados por ID, título ou técnico"
              placeholder="Buscar por ID, título ou técnico..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full md:w-80 pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-900/40 border-b border-gray-100 dark:border-slate-700">
              {COLUMNS.map(col => {
                const active = sort.key === col.key;
                const SortIcon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`text-${col.align ?? 'left'} py-3 px-5 text-[11px] font-semibold text-minerva-navy/70 dark:text-white/70 uppercase tracking-wider`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={`inline-flex items-center gap-1.5 transition-colors ${
                        active
                          ? 'text-minerva-red dark:text-minerva-red-light'
                          : 'hover:text-minerva-red dark:hover:text-minerva-red-light'
                      }`}
                    >
                      {col.label}
                      <SortIcon
                        className={`w-3 h-3 ${active ? '' : 'opacity-50'}`}
                        aria-hidden
                      />
                    </button>
                  </th>
                );
              })}
              <th
                scope="col"
                className="text-center py-3 px-5 text-[11px] font-semibold text-minerva-navy/70 dark:text-white/70 uppercase tracking-wider"
              >
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
            {displayed.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length + 1}
                  className="py-12 text-center text-gray-400 dark:text-gray-500"
                >
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden />
                  <p>Nenhum chamado encontrado</p>
                </td>
              </tr>
            ) : (
              displayed.map((ticket, index) => {
                const hoursWarning = getHoursWarning(ticket);
                const stale = getStaleInfo(ticket);
                const techDisplay = formatTechnicianName(ticket.assigned_technician);
                const isUnassigned = techDisplay === 'Não atribuído';
                return (
                  <tr
                    key={ticket.id}
                    className="group hover:bg-gray-50/80 dark:hover:bg-slate-700/40 transition-colors"
                    style={{ animationDelay: `${index * 0.03}s` }}
                  >
                    {/* ID */}
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-xs text-minerva-navy dark:text-white font-semibold tabular-nums whitespace-nowrap inline-flex items-center px-2 py-1 rounded-md bg-minerva-navy/5 dark:bg-white/5 border border-minerva-navy/10 dark:border-white/10">
                        #{ticket.id}
                      </span>
                    </td>

                    {/* Título — link pro GLPI */}
                    <td className="py-3.5 px-5">
                      <a
                        href={`${GLPI_BASE_URL}${ticket.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-minerva-navy dark:text-white hover:text-minerva-red dark:hover:text-minerva-red-light font-medium transition-colors flex items-start gap-2 max-w-xl"
                        title={ticket.title}
                      >
                        <span className="line-clamp-2 leading-snug">{ticket.title}</span>
                        <ExternalLink
                          className="w-3.5 h-3.5 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0"
                          aria-hidden
                        />
                      </a>
                    </td>

                    {/* Tipo */}
                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border whitespace-nowrap ${getTypeBadgeStyle(ticket.type)}`}
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

                    {/* Status (+ avisos) */}
                    <td className="py-3.5 px-5">
                      <div className="flex flex-col gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border w-fit ${getStatusBadgeStyle(ticket.status)}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${getStatusDot(ticket.status)}`}
                            aria-hidden
                          />
                          {ticket.status}
                        </span>
                        {stale.isStale && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] text-minerva-red dark:text-rose-300 font-medium"
                            title={`Em aberto há ${Math.floor(stale.daysOpen)} dias`}
                          >
                            <AlarmClock className="w-3 h-3" aria-hidden />
                            Aberto há {Math.floor(stale.daysOpen)}d
                          </span>
                        )}
                        {hoursWarning && (
                          <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-300">
                            <AlertTriangle className="w-3 h-3" aria-hidden />
                            {hoursWarning}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Técnico — avatar com inicial + nome */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-semibold text-white ${
                            isUnassigned ? 'bg-gray-400 dark:bg-slate-500' : avatarColor(techDisplay)
                          }`}
                          aria-hidden
                        >
                          {technicianInitials(techDisplay)}
                        </span>
                        <span
                          className={`text-sm ${
                            isUnassigned
                              ? 'italic text-gray-400 dark:text-gray-500'
                              : 'text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          {techDisplay}
                        </span>
                      </div>
                    </td>

                    {/* Horas planejadas */}
                    <td className="py-3.5 px-5 text-center">
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          ticket.planned_time_hours > 0
                            ? 'text-minerva-navy dark:text-white'
                            : 'text-gray-300 dark:text-slate-600'
                        }`}
                      >
                        {formatHoursMinutes(ticket.planned_time_hours)}
                      </span>
                    </td>

                    {/* Horas realizadas */}
                    <td className="py-3.5 px-5 text-center">
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          ticket.realized_time_hours > 0
                            ? 'text-emerald-600 dark:text-emerald-300'
                            : 'text-gray-300 dark:text-slate-600'
                        }`}
                      >
                        {formatHoursMinutes(ticket.realized_time_hours)}
                      </span>
                    </td>

                    {/* Horas legado */}
                    <td className="py-3.5 px-5 text-center">
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          ticket.legacy_time_hours > 0
                            ? 'text-amber-600 dark:text-amber-300'
                            : 'text-gray-300 dark:text-slate-600'
                        }`}
                      >
                        {formatHoursMinutes(ticket.legacy_time_hours)}
                      </span>
                    </td>

                    {/* Data abertura */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="w-3.5 h-3.5 opacity-60" aria-hidden />
                        <div className="flex flex-col leading-tight">
                          <span className="font-medium tabular-nums">
                            {formatDate(ticket.created_at)}
                          </span>
                          <span className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
                            {formatTime(ticket.created_at)}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Ações */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectTicket(ticket)}
                          aria-label={`Ver detalhes do chamado ${ticket.id}`}
                          className="inline-flex items-center justify-center w-8 h-8 bg-minerva-navy/5 dark:bg-white/5 hover:bg-minerva-navy hover:text-white text-minerva-navy dark:text-white rounded-lg transition-all"
                          title="Ver detalhes"
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden />
                        </button>
                        <a
                          href={`${GLPI_BASE_URL}${ticket.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Abrir chamado ${ticket.id} no GLPI`}
                          className="inline-flex items-center justify-center w-8 h-8 bg-minerva-navy/5 dark:bg-white/5 hover:bg-minerva-red hover:text-white text-minerva-navy dark:text-white rounded-lg transition-all"
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

      {/* Legenda + paginação */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900/30 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {totalPages > 1 && (
            <p>
              Mostrando <span className="font-medium text-minerva-navy dark:text-white">{startIndex + 1}</span>
              –<span className="font-medium text-minerva-navy dark:text-white">
                {Math.min(startIndex + itemsPerPage, sorted.length)}
              </span>{' '}
              de <span className="font-medium text-minerva-navy dark:text-white">{sorted.length}</span>
            </p>
          )}
          <div className="hidden md:flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <Tag className="w-3 h-3 opacity-70" aria-hidden />
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden />
                Incidente
              </span>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" aria-hidden />
                Requisição
              </span>
            </span>
          </div>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm font-medium text-minerva-navy dark:text-white bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Anterior
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) pageNum = i + 1;
                else if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    aria-current={currentPage === pageNum ? 'page' : undefined}
                    className={`w-9 h-9 text-sm font-medium rounded-lg transition-all tabular-nums ${
                      currentPage === pageNum
                        ? 'bg-minerva-navy text-white shadow-sm'
                        : 'text-minerva-navy dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm font-medium text-minerva-navy dark:text-white bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Próximo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
