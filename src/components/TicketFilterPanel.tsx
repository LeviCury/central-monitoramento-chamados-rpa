import { Calendar, Filter, X, ChevronDown, Clock } from 'lucide-react';
import { FilterState } from '../types';
import { useState } from 'react';

// Tipos de período rápido
type QuickPeriod = 'today' | '7days' | '30days' | 'thisMonth' | 'lastMonth';

interface QuickPeriodOption {
  id: QuickPeriod;
  label: string;
  getRange: () => { start: string; end: string };
}

// Função auxiliar para formatar data no formato YYYY-MM-DD
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Opções de período rápido
const quickPeriodOptions: QuickPeriodOption[] = [
  {
    id: 'today',
    label: 'Hoje',
    getRange: () => {
      const today = formatDate(new Date());
      return { start: today, end: today };
    },
  },
  {
    id: '7days',
    label: '7 dias',
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);
      return { start: formatDate(start), end: formatDate(end) };
    },
  },
  {
    id: '30days',
    label: '30 dias',
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);
      return { start: formatDate(start), end: formatDate(end) };
    },
  },
  {
    id: 'thisMonth',
    label: 'Este mês',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date();
      return { start: formatDate(start), end: formatDate(end) };
    },
  },
  {
    id: 'lastMonth',
    label: 'Mês anterior',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: formatDate(start), end: formatDate(end) };
    },
  },
];

interface TicketFilterPanelProps {
  filters: FilterState;
  statuses: string[];
  priorities: string[];
  technicians: string[];
  onFilterChange: (filters: FilterState) => void;
}

export default function TicketFilterPanel({
  filters,
  statuses,
  priorities,
  technicians,
  onFilterChange,
}: TicketFilterPanelProps) {
  const [expandedSections, setExpandedSections] = useState({
    period: true,
    status: true,
    priority: true,
    technician: true,
  });
  const [selectedQuickPeriod, setSelectedQuickPeriod] = useState<QuickPeriod | null>(null);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleQuickPeriodSelect = (option: QuickPeriodOption) => {
    const range = option.getRange();
    setSelectedQuickPeriod(option.id);
    onFilterChange({
      ...filters,
      dateRange: range,
    });
  };

  const handleStatusToggle = (status: string) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onFilterChange({ ...filters, statuses: newStatuses });
  };

  const handlePriorityToggle = (priority: string) => {
    const newPriorities = filters.priorities.includes(priority)
      ? filters.priorities.filter(p => p !== priority)
      : [...filters.priorities, priority];
    onFilterChange({ ...filters, priorities: newPriorities });
  };

  const handleTechnicianToggle = (technician: string) => {
    const newTechnicians = filters.technicians.includes(technician)
      ? filters.technicians.filter((t) => t !== technician)
      : [...filters.technicians, technician];
    onFilterChange({ ...filters, technicians: newTechnicians });
  };

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    setSelectedQuickPeriod(null); // Limpa seleção de período rápido ao alterar manualmente
    onFilterChange({
      ...filters,
      dateRange: { ...filters.dateRange, [field]: value },
    });
  };

  const hasActiveFilters =
    filters.dateRange.start ||
    filters.dateRange.end ||
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.technicians.length > 0;

  const activeFilterCount =
    (filters.dateRange.start ? 1 : 0) +
    (filters.dateRange.end ? 1 : 0) +
    filters.statuses.length +
    filters.priorities.length +
    filters.technicians.length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-minerva overflow-hidden">
      {/* Header */}
      <div className="bg-minerva-navy px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Filter className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Filtros</h2>
              {activeFilterCount > 0 && (
                <p className="text-white/60 text-xs">{activeFilterCount} filtro(s) ativo(s)</p>
              )}
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSelectedQuickPeriod(null);
                onFilterChange({
                  dateRange: { start: '', end: '' },
                  statuses: [],
                  priorities: [],
                  technicians: [],
                });
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-minerva-red/20 hover:bg-minerva-red/30 rounded-lg text-white text-xs font-medium transition-colors"
            >
              <X className="w-3 h-3" />
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Filtro de Período */}
        <div className="border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('period')}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-minerva-navy dark:text-white" />
              <span className="text-sm font-medium text-minerva-navy dark:text-white">Período</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-minerva-navy/60 dark:text-white/60 transition-transform ${expandedSections.period ? 'rotate-180' : ''}`} />
          </button>
          
          {expandedSections.period && (
            <div className="p-4 space-y-4 bg-white dark:bg-slate-800">
              {/* Botões de Período Rápido */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                  <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Período rápido</label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {quickPeriodOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleQuickPeriodSelect(option)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        selectedQuickPeriod === option.id
                          ? 'bg-minerva-navy text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Separador */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-600"></div>
                <span className="text-xs text-gray-400 dark:text-gray-500">ou selecione</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-600"></div>
              </div>

              {/* Campos de Data Manual */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block font-medium">Início</label>
                  <input
                    type="date"
                    value={filters.dateRange.start}
                    onChange={(e) => handleDateChange('start', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-minerva-navy/20 focus:border-minerva-navy text-sm transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block font-medium">Fim</label>
                  <input
                    type="date"
                    value={filters.dateRange.end}
                    onChange={(e) => handleDateChange('end', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-minerva-navy/20 focus:border-minerva-navy text-sm transition-all"
                  />
                </div>
              </div>

              {!filters.dateRange.start && !filters.dateRange.end && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></div>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Selecione um período para ver a média de horas
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filtro de Status */}
        {statuses.length > 0 && (
          <div className="border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('status')}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-sm font-medium text-minerva-navy dark:text-white">Status</span>
                {filters.statuses.length > 0 && (
                  <span className="px-2 py-0.5 bg-minerva-navy text-white text-xs rounded-full">
                    {filters.statuses.length}
                  </span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-minerva-navy/60 dark:text-white/60 transition-transform ${expandedSections.status ? 'rotate-180' : ''}`} />
            </button>
            
            {expandedSections.status && (
              <div className="p-4 space-y-2 bg-white dark:bg-slate-800 max-h-48 overflow-y-auto">
                {statuses.map((status) => (
                  <label 
                    key={status} 
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                      filters.statuses.includes(status) 
                        ? 'bg-minerva-navy/5 dark:bg-minerva-navy/30 border border-minerva-navy/20 dark:border-minerva-navy/40' 
                        : 'hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={filters.statuses.includes(status)}
                      onChange={() => handleStatusToggle(status)}
                      className="w-4 h-4 text-minerva-navy border-gray-300 dark:border-slate-500 rounded focus:ring-minerva-navy/20"
                    />
                    <span className="text-sm text-minerva-navy dark:text-white">{status}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filtro de Prioridade */}
        {priorities.length > 0 && (
          <div className="border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('priority')}
              aria-expanded={expandedSections.priority}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full" aria-hidden />
                <span className="text-sm font-medium text-minerva-navy dark:text-white">Prioridade</span>
                {filters.priorities.length > 0 && (
                  <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">
                    {filters.priorities.length}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`w-4 h-4 text-minerva-navy/60 dark:text-white/60 transition-transform ${expandedSections.priority ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>

            {expandedSections.priority && (
              <div className="p-4 space-y-2 bg-white dark:bg-slate-800 max-h-48 overflow-y-auto">
                {priorities.map(priority => (
                  <label
                    key={priority}
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                      filters.priorities.includes(priority)
                        ? 'bg-amber-500/5 dark:bg-amber-500/20 border border-amber-500/30'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={filters.priorities.includes(priority)}
                      onChange={() => handlePriorityToggle(priority)}
                      className="w-4 h-4 text-amber-500 border-gray-300 dark:border-slate-500 rounded focus:ring-amber-500/20"
                      aria-label={`Filtrar por prioridade ${priority}`}
                    />
                    <span className="text-sm text-minerva-navy dark:text-white">{priority}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filtro de Técnico */}
        {technicians.length > 0 && (
          <div className="border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('technician')}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-minerva-red rounded-full"></div>
                <span className="text-sm font-medium text-minerva-navy dark:text-white">Técnico</span>
                {filters.technicians.length > 0 && (
                  <span className="px-2 py-0.5 bg-minerva-red text-white text-xs rounded-full">
                    {filters.technicians.length}
                  </span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-minerva-navy/60 dark:text-white/60 transition-transform ${expandedSections.technician ? 'rotate-180' : ''}`} />
            </button>
            
            {expandedSections.technician && (
              <div className="p-4 space-y-2 bg-white dark:bg-slate-800 max-h-56 overflow-y-auto">
                {technicians.map((technician) => (
                  <label 
                    key={technician} 
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                      filters.technicians.includes(technician) 
                        ? 'bg-minerva-red/5 dark:bg-minerva-red/20 border border-minerva-red/20 dark:border-minerva-red/40' 
                        : 'hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={filters.technicians.includes(technician)}
                      onChange={() => handleTechnicianToggle(technician)}
                      className="w-4 h-4 text-minerva-red border-gray-300 dark:border-slate-500 rounded focus:ring-minerva-red/20"
                    />
                    <span className="text-sm text-minerva-navy dark:text-white">{technician}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
