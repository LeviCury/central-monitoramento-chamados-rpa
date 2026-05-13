import {
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Filter,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { FilterState, TicketType } from '../types';
import { useState } from 'react';

// ============================================================
// Quick periods
// ============================================================
type QuickPeriod = 'today' | '7days' | '30days' | 'thisMonth' | 'lastMonth';

interface QuickPeriodOption {
  id: QuickPeriod;
  label: string;
  getRange: () => { start: string; end: string };
}

const formatDate = (date: Date): string => date.toISOString().split('T')[0];

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
    label: 'Mês ant.',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: formatDate(start), end: formatDate(end) };
    },
  },
];

// ============================================================
// Component
// ============================================================
interface TicketFilterPanelProps {
  filters: FilterState;
  statuses: string[];
  priorities: string[];
  technicians: string[];
  onFilterChange: (filters: FilterState) => void;
}

const TYPE_OPTIONS: { id: TicketType; label: string; subtitle: string; dot: string }[] = [
  {
    id: 'incident',
    label: 'Incidente',
    subtitle: 'algo quebrou na operação',
    dot: 'bg-rose-500',
  },
  {
    id: 'request',
    label: 'Requisição',
    subtitle: 'solicitação · melhoria · projeto',
    dot: 'bg-sky-500',
  },
];

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
    type: true,
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
    onFilterChange({ ...filters, dateRange: range });
  };

  const handleStatusToggle = (status: string) => {
    const next = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    onFilterChange({ ...filters, statuses: next });
  };

  const handlePriorityToggle = (priority: string) => {
    const next = filters.priorities.includes(priority)
      ? filters.priorities.filter(p => p !== priority)
      : [...filters.priorities, priority];
    onFilterChange({ ...filters, priorities: next });
  };

  const handleTechnicianToggle = (technician: string) => {
    const next = filters.technicians.includes(technician)
      ? filters.technicians.filter(t => t !== technician)
      : [...filters.technicians, technician];
    onFilterChange({ ...filters, technicians: next });
  };

  const handleTypeToggle = (type: TicketType) => {
    const current = filters.types ?? [];
    const next = current.includes(type) ? current.filter(t => t !== type) : [...current, type];
    onFilterChange({ ...filters, types: next });
  };

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    setSelectedQuickPeriod(null);
    onFilterChange({
      ...filters,
      dateRange: { ...filters.dateRange, [field]: value },
    });
  };

  const typesActive = filters.types ?? [];

  const hasActiveFilters =
    filters.dateRange.start ||
    filters.dateRange.end ||
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.technicians.length > 0 ||
    typesActive.length > 0;

  const activeFilterCount =
    (filters.dateRange.start ? 1 : 0) +
    (filters.dateRange.end ? 1 : 0) +
    filters.statuses.length +
    filters.priorities.length +
    filters.technicians.length +
    typesActive.length;

  const clearAll = () => {
    setSelectedQuickPeriod(null);
    onFilterChange({
      dateRange: { start: '', end: '' },
      statuses: [],
      priorities: [],
      technicians: [],
      types: [],
    });
  };

  return (
    <div className="surface-elevated rounded-3xl overflow-hidden lg:sticky lg:top-24">
      <header className="px-6 pt-5 pb-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
              <Filter className="w-3.5 h-3.5" aria-hidden />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)] tracking-[-0.01em]">
                Filtros
              </h2>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                {activeFilterCount > 0
                  ? `${activeFilterCount} ativo${activeFilterCount === 1 ? '' : 's'}`
                  : 'Refine a visualização'}
              </p>
            </div>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Limpar todos os filtros"
            >
              <X className="w-3 h-3" aria-hidden />
              Limpar
            </button>
          )}
        </div>
      </header>

      <div className="p-5 space-y-2">
        <FilterSection
          title="Período"
          icon={<Calendar className="w-3.5 h-3.5" />}
          expanded={expandedSections.period}
          onToggle={() => toggleSection('period')}
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-3 h-3 text-[var(--text-tertiary)]" aria-hidden />
              <label className="text-[10px] uppercase tracking-wider-2 text-[var(--text-tertiary)] font-semibold">
                Período rápido
              </label>
            </div>
            <div
              role="radiogroup"
              aria-label="Período rápido"
              className="grid grid-cols-3 gap-0.5 p-0.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
            >
              {quickPeriodOptions.map(option => {
                const active = selectedQuickPeriod === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => handleQuickPeriodSelect(option)}
                    className={[
                      'px-2 py-1.5 text-[11px] font-semibold rounded-lg transition-all',
                      active
                        ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-subtle'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
            <span className="text-[10px] uppercase tracking-wider-2 text-[var(--text-tertiary)]">
              ou personalize
            </span>
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <DateInput
              label="Início"
              value={filters.dateRange.start}
              onChange={v => handleDateChange('start', v)}
            />
            <DateInput
              label="Fim"
              value={filters.dateRange.end}
              onChange={v => handleDateChange('end', v)}
            />
          </div>

          {!filters.dateRange.start && !filters.dateRange.end && (
            <p
              className="text-[11px] text-[var(--text-tertiary)] leading-snug mt-2.5"
              role="note"
            >
              Defina um período para ver comparativo com o período anterior.
            </p>
          )}
        </FilterSection>

        {statuses.length > 0 && (
          <FilterSection
            title="Status"
            icon={<span className="block w-2 h-2 rounded-full bg-emerald-500" aria-hidden />}
            badge={filters.statuses.length}
            expanded={expandedSections.status}
            onToggle={() => toggleSection('status')}
          >
            {filters.statuses.length > 0 && (
              <ActiveChips
                items={filters.statuses}
                onRemove={s => handleStatusToggle(s)}
              />
            )}
            <div className="space-y-0.5 max-h-44 overflow-y-auto pr-1">
              {statuses.map(status => (
                <FilterCheckRow
                  key={status}
                  label={status}
                  checked={filters.statuses.includes(status)}
                  onToggle={() => handleStatusToggle(status)}
                />
              ))}
            </div>
          </FilterSection>
        )}

        <FilterSection
          title="Tipo"
          icon={<Tag className="w-3.5 h-3.5" />}
          badge={typesActive.length}
          expanded={expandedSections.type}
          onToggle={() => toggleSection('type')}
        >
          <p className="text-[11px] text-[var(--text-tertiary)] mb-2.5">
            Mostrar apenas estes tipos. Vazio = todos.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TYPE_OPTIONS.map(opt => {
              const active = typesActive.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleTypeToggle(opt.id)}
                  aria-pressed={active}
                  className={[
                    'relative px-3 py-2.5 text-left rounded-xl border transition-all',
                    active
                      ? 'bg-[var(--text-primary)] text-[var(--bg-elevated)] border-[var(--text-primary)]'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-default)]',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} aria-hidden />
                    <span className="text-sm font-semibold">{opt.label}</span>
                  </div>
                  <span
                    className={`block text-[10px] mt-1 leading-tight ${
                      active ? 'opacity-70' : 'text-[var(--text-tertiary)]'
                    }`}
                  >
                    {opt.subtitle}
                  </span>
                </button>
              );
            })}
          </div>
        </FilterSection>

        {priorities.length > 0 && (
          <FilterSection
            title="Prioridade"
            icon={<span className="block w-2 h-2 rounded-full bg-amber-500" aria-hidden />}
            badge={filters.priorities.length}
            expanded={expandedSections.priority}
            onToggle={() => toggleSection('priority')}
          >
            {filters.priorities.length > 0 && (
              <ActiveChips
                items={filters.priorities}
                onRemove={p => handlePriorityToggle(p)}
              />
            )}
            <div className="space-y-0.5 max-h-44 overflow-y-auto pr-1">
              {priorities.map(priority => (
                <FilterCheckRow
                  key={priority}
                  label={priority}
                  checked={filters.priorities.includes(priority)}
                  onToggle={() => handlePriorityToggle(priority)}
                />
              ))}
            </div>
          </FilterSection>
        )}

        {technicians.length > 0 && (
          <FilterSection
            title="Técnico"
            icon={<Users className="w-3.5 h-3.5" />}
            badge={filters.technicians.length}
            expanded={expandedSections.technician}
            onToggle={() => toggleSection('technician')}
          >
            {filters.technicians.length > 0 && (
              <ActiveChips
                items={filters.technicians}
                onRemove={t => handleTechnicianToggle(t)}
              />
            )}
            <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
              {technicians.map(technician => (
                <FilterCheckRow
                  key={technician}
                  label={technician}
                  checked={filters.technicians.includes(technician)}
                  onToggle={() => handleTechnicianToggle(technician)}
                />
              ))}
            </div>
          </FilterSection>
        )}
      </div>
    </div>
  );
}

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  badge?: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function FilterSection({
  title,
  icon,
  badge,
  expanded,
  onToggle,
  children,
}: FilterSectionProps) {
  return (
    <div className="border-b border-[var(--border-subtle)] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between py-3 text-left transition-colors group"
      >
        <span className="flex items-center gap-2.5">
          <span className="text-[var(--text-tertiary)] inline-flex">{icon}</span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.125rem] h-[18px] px-1.5 rounded-full text-[10px] font-semibold tnum bg-[var(--text-primary)] text-[var(--bg-elevated)]">
              {badge}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {expanded && <div className="pb-4 pt-1 space-y-2.5">{children}</div>}
    </div>
  );
}

interface ActiveChipsProps {
  items: string[];
  onRemove: (item: string) => void;
}

function ActiveChips({ items, onRemove }: ActiveChipsProps) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {items.map(item => (
        <span
          key={item}
          className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-[11px] font-medium bg-[var(--bg-subtle)] text-[var(--text-primary)]"
        >
          <span className="truncate max-w-[140px]">{item}</span>
          <button
            type="button"
            onClick={() => onRemove(item)}
            aria-label={`Remover ${item}`}
            className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-[var(--border-subtle)]"
          >
            <X className="w-3 h-3 opacity-70" aria-hidden />
          </button>
        </span>
      ))}
    </div>
  );
}

interface FilterCheckRowProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

function FilterCheckRow({ label, checked, onToggle }: FilterCheckRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left text-sm hover:bg-[var(--bg-subtle)] transition-colors text-[var(--text-primary)]"
    >
      <span
        className={[
          'inline-flex items-center justify-center w-4 h-4 rounded border transition-all shrink-0',
          checked
            ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-elevated)]'
            : 'border-[var(--border-default)] bg-transparent',
        ].join(' ')}
        aria-hidden
      >
        {checked && <Check className="w-3 h-3" strokeWidth={3} />}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

interface DateInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function DateInput({ label, value, onChange }: DateInputProps) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider-2 text-[var(--text-tertiary)] font-semibold mb-1 block">
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-color)] focus:border-transparent transition-all tnum"
      />
    </div>
  );
}
