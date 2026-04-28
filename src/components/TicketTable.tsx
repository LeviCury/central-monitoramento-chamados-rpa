import { Ticket } from '../types';
import { AlertTriangle, ExternalLink, Eye, FileText, Search } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { formatHoursMinutes } from '../utils/timeFormat';

interface TicketTableProps {
  tickets: Ticket[];
  onSelectTicket: (ticket: Ticket) => void;
}

const GLPI_BASE_URL = 'https://central.minervafoods.com/front/ticket.form.php?id=';

// Estilos para Light Mode
const STATUS_STYLES_LIGHT: Record<string, string> = {
  'Fechado': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Solucionado': 'bg-blue-100 text-blue-700 border-blue-200',
  'Novo': 'bg-violet-100 text-violet-700 border-violet-200',
  'Em Atendimento (atribuído)': 'bg-minerva-red/10 text-minerva-red border-minerva-red/20',
  'Em Atendimento (planejado)': 'bg-amber-100 text-amber-700 border-amber-200',
  'Pendente': 'bg-red-100 text-red-700 border-red-200',
};

// Estilos para Dark Mode (mais vibrantes)
const STATUS_STYLES_DARK: Record<string, string> = {
  'Fechado': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Solucionado': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Novo': 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'Em Atendimento (atribuído)': 'bg-minerva-red/20 text-red-300 border-minerva-red/30',
  'Em Atendimento (planejado)': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'Pendente': 'bg-red-500/20 text-red-300 border-red-500/30',
};

export default function TicketTable({ tickets, onSelectTicket }: TicketTableProps) {
  const { isDark } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Seleciona os estilos baseado no tema
  const getStatusBadgeStyle = (status: string) => {
    const styles = isDark ? STATUS_STYLES_DARK : STATUS_STYLES_LIGHT;
    const defaultStyle = isDark 
      ? 'bg-gray-500/20 text-gray-300 border-gray-500/30'
      : 'bg-gray-100 text-gray-700 border-gray-200';
    return styles[status] || defaultStyle;
  };

  const filteredTickets = tickets.filter(ticket => 
    ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.assigned_technician?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedTickets = filteredTickets.slice(startIndex, startIndex + itemsPerPage);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
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

  const getHoursWarning = (ticket: Ticket) => {
    if (ticket.hours_status === 'missing_planned') return 'Falta planejado';
    if (ticket.hours_status === 'missing_realized') return 'Falta realizado';
    if (ticket.hours_status === 'missing_both') return 'Faltam apontamentos';
    if (ticket.hours_status === 'legacy') return 'Legado';
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-minerva overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 bg-gradient-to-r from-minerva-navy to-minerva-navy-light">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Lista de Chamados</h2>
              <p className="text-white/60 text-sm">{filteredTickets.length} chamados encontrados</p>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
            <input
              type="text"
              placeholder="Buscar por ID, título ou técnico..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full md:w-80 pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-700 border-b border-gray-100 dark:border-slate-600">
              <th className="text-left py-4 px-6 text-xs font-semibold text-minerva-navy dark:text-white uppercase tracking-wider">ID</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-minerva-navy dark:text-white uppercase tracking-wider">Título</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-minerva-navy dark:text-white uppercase tracking-wider">Status</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-minerva-navy dark:text-white uppercase tracking-wider">Técnico</th>
              <th className="text-center py-4 px-6 text-xs font-semibold text-minerva-navy dark:text-white uppercase tracking-wider">Planejado</th>
              <th className="text-center py-4 px-6 text-xs font-semibold text-minerva-navy dark:text-white uppercase tracking-wider">Realizado</th>
              <th className="text-center py-4 px-6 text-xs font-semibold text-minerva-navy dark:text-white uppercase tracking-wider">Legado</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-minerva-navy dark:text-white uppercase tracking-wider">Data Abertura</th>
              <th className="text-center py-4 px-6 text-xs font-semibold text-minerva-navy dark:text-white uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {displayedTickets.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-gray-400 dark:text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum chamado encontrado</p>
                </td>
              </tr>
            ) : (
              displayedTickets.map((ticket, index) => {
                const hoursWarning = getHoursWarning(ticket);

                return (
                  <tr 
                    key={ticket.id} 
                    className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    style={{ animationDelay: `${index * 0.03}s` }}
                  >
                  <td className="py-4 px-6">
                    <span className="font-mono text-sm text-minerva-navy dark:text-white font-medium">
                      #{ticket.id}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <a
                      href={`${GLPI_BASE_URL}${ticket.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-minerva-navy dark:text-white hover:text-minerva-red font-medium transition-colors group flex items-center gap-2 max-w-md"
                    >
                      <span className="truncate">{ticket.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </a>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border ${getStatusBadgeStyle(ticket.status)}`}>
                      {ticket.status}
                    </span>
                    {hoursWarning && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-amber-600 dark:text-amber-300">
                        <AlertTriangle className="w-3 h-3" />
                        {hoursWarning}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {formatTechnicianName(ticket.assigned_technician)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-sm font-semibold text-minerva-navy dark:text-white">
                      {formatHoursMinutes(ticket.planned_time_hours)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                      {formatHoursMinutes(ticket.realized_time_hours)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-300">
                      {formatHoursMinutes(ticket.legacy_time_hours)}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(ticket.created_at)}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onSelectTicket(ticket)}
                        className="inline-flex items-center justify-center w-9 h-9 bg-minerva-navy/5 dark:bg-white/10 hover:bg-minerva-navy hover:text-white text-minerva-navy dark:text-white rounded-xl transition-all"
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    <a
                      href={`${GLPI_BASE_URL}${ticket.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-9 h-9 bg-minerva-navy/5 dark:bg-white/10 hover:bg-minerva-red hover:text-white text-minerva-navy dark:text-white rounded-xl transition-all"
                      title="Abrir no GLPI"
                    >
                      <ExternalLink className="w-4 h-4" />
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700 border-t border-gray-100 dark:border-slate-600 flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredTickets.length)} de {filteredTickets.length} chamados
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-medium text-minerva-navy dark:text-white bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Anterior
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 text-sm font-medium rounded-xl transition-all ${
                      currentPage === pageNum
                        ? 'bg-minerva-navy text-white'
                        : 'text-minerva-navy dark:text-white hover:bg-gray-100 dark:hover:bg-slate-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm font-medium text-minerva-navy dark:text-white bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Próximo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
