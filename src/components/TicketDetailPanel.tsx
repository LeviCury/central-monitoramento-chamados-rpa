import {
  AlertTriangle,
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  User,
  X,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Ticket, TicketHoursStatus, TicketTaskKind } from '../types';
import { formatHoursMinutes } from '../utils/timeFormat';

interface TicketDetailPanelProps {
  ticket: Ticket | null;
  onClose: () => void;
}

const GLPI_BASE_URL = 'https://central.minervafoods.com/front/ticket.form.php?id=';

const STATUS_LABELS: Record<TicketHoursStatus, string> = {
  not_loaded: 'Apontamentos não carregados',
  complete: 'Planejado e realizado apontados',
  missing_planned: 'Falta apontamento planejado',
  missing_realized: 'Falta apontamento realizado',
  missing_both: 'Faltam apontamentos planejado e realizado',
  legacy: 'Chamado legado',
  no_rpa_tasks: 'Sem apontamentos RPA',
};

const KIND_LABELS: Record<TicketTaskKind, string> = {
  planned: 'Planejado',
  realized: 'Realizado',
  legacy: 'Legado',
};

const KIND_TONE: Record<
  TicketTaskKind,
  { chip: string; bar: string; barBg: string }
> = {
  planned: {
    chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
    bar: 'bg-sky-500',
    barBg: 'bg-[var(--bg-subtle)]',
  },
  realized: {
    chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    bar: 'bg-emerald-500',
    barBg: 'bg-[var(--bg-subtle)]',
  },
  legacy: {
    chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    bar: 'bg-amber-500',
    barBg: 'bg-[var(--bg-subtle)]',
  },
};

const STATUS_BADGE: Record<string, string> = {
  Fechado: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  Solucionado: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  Novo: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  'Em Atendimento (atribuído)': 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  'Em Atendimento (planejado)': 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  Pendente: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
};

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

function initials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TicketDetailPanel({ ticket, onClose }: TicketDetailPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!ticket) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [ticket, onClose]);

  if (!ticket) return null;

  const hasPendingNote =
    ticket.hours_status === 'missing_planned' ||
    ticket.hours_status === 'missing_realized' ||
    ticket.hours_status === 'missing_both';

  const statusBadgeClass =
    STATUS_BADGE[ticket.status] ??
    'bg-[var(--bg-subtle)] text-[var(--text-secondary)]';

  const techDisplay = ticket.assigned_technician || 'Não atribuído';

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Fechar detalhes"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in"
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        className="relative h-full w-full max-w-2xl overflow-y-auto bg-[var(--bg-base)] shadow-lifted animate-slide-in-right outline-none"
      >
        {/* Header sticky neutro */}
        <div className="sticky top-0 z-10 glass-strong border-b border-[var(--border-subtle)] px-7 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] text-[var(--text-secondary)] font-semibold">
                  #{ticket.id}
                </span>
                <span className="text-[var(--text-tertiary)]">·</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ${statusBadgeClass}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden />
                  {ticket.status}
                </span>
                {ticket.priority && (
                  <>
                    <span className="text-[var(--text-tertiary)]">·</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--bg-subtle)]">
                      Prioridade {ticket.priority}
                    </span>
                  </>
                )}
              </div>
              <h2
                id="ticket-detail-title"
                className="text-xl font-semibold text-[var(--text-primary)] mt-3 leading-tight tracking-[-0.015em]"
              >
                {ticket.title}
              </h2>
              <a
                href={`${GLPI_BASE_URL}${ticket.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs mt-3 transition-colors group"
              >
                Abrir no GLPI
                <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" aria-hidden />
              </a>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="inline-flex items-center justify-center w-9 h-9 bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl transition-all"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="p-7 space-y-6">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <HoursCard
              label="Planejado"
              value={ticket.planned_time_hours}
              tone="planned"
            />
            <HoursCard
              label="Realizado"
              value={ticket.realized_time_hours}
              tone="realized"
            />
            <HoursCard
              label="Legado"
              value={ticket.legacy_time_hours}
              tone="legacy"
            />
          </section>

          <section className="surface-elevated rounded-2xl p-4">
            <div className="flex items-center gap-3">
              {hasPendingNote ? (
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4" aria-hidden />
                </span>
              ) : (
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Clock className="w-4 h-4" aria-hidden />
                </span>
              )}
              <p className="font-medium text-[var(--text-primary)] text-sm">
                {STATUS_LABELS[ticket.hours_status]}
              </p>
            </div>
          </section>

          <section className="surface-elevated rounded-2xl overflow-hidden">
            <div className="px-5 pt-4 pb-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider-2 text-[var(--text-tertiary)]">
                Resumo do chamado
              </h3>
            </div>
            <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <Field
                icon={<User className="w-3 h-3" />}
                label="Técnico"
                value={techDisplay}
              />
              <Field
                icon={<User className="w-3 h-3" />}
                label="Solicitante"
                value={ticket.requester || '-'}
              />
              <Field
                icon={<Calendar className="w-3 h-3" />}
                label="Data abertura"
                value={formatDate(ticket.opened_date)}
              />
              <Field
                icon={<Calendar className="w-3 h-3" />}
                label="Última atualização"
                value={formatDate(ticket.updated_date ?? null)}
              />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                <FileText className="w-3.5 h-3.5" aria-hidden />
              </span>
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)] tracking-[-0.01em]">
                Apontamentos por colaborador
              </h3>
            </div>

            {ticket.collaborator_hours.length === 0 ? (
              <div className="surface rounded-2xl p-8 text-center text-[var(--text-tertiary)] text-sm">
                Nenhum apontamento dos colaboradores RPA permitidos foi encontrado.
              </div>
            ) : (
              <CollaboratorBars collaborators={ticket.collaborator_hours} />
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

// ============================================================
// Subcomponents
// ============================================================

interface HoursCardProps {
  label: string;
  value: number;
  tone: TicketTaskKind;
}

function HoursCard({ label, value, tone }: HoursCardProps) {
  const t = KIND_TONE[tone];
  return (
    <div className="surface-elevated rounded-2xl p-4 relative">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[10px] uppercase tracking-wider-2 font-semibold text-[var(--text-tertiary)]">
          {label}
        </p>
        <span className={`w-1.5 h-1.5 rounded-full ${t.bar}`} aria-hidden />
      </div>
      <p className="text-2xl font-semibold tracking-tighter-2 leading-none tnum text-[var(--text-primary)]">
        {formatHoursMinutes(value)}
      </p>
    </div>
  );
}

interface FieldProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function Field({ icon, label, value }: FieldProps) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider-2 font-semibold text-[var(--text-tertiary)] flex items-center gap-1.5">
        <span className="opacity-60">{icon}</span>
        {label}
      </p>
      <p className="text-sm text-[var(--text-primary)] font-medium mt-1 leading-snug">
        {value}
      </p>
    </div>
  );
}

interface CollaboratorBarsProps {
  collaborators: Ticket['collaborator_hours'];
}

function CollaboratorBars({ collaborators }: CollaboratorBarsProps) {
  // Maior soma absoluta entre colaboradores — usado para escalonar as barras.
  const max = Math.max(
    1,
    ...collaborators.map(
      c => Math.max(c.planned_hours, c.realized_hours, c.legacy_hours)
    )
  );

  return (
    <div className="space-y-3">
      {collaborators.map(c => {
        return (
          <div
            key={c.collaborator}
            className="surface-elevated rounded-2xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center gap-3">
              <span
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(c.collaborator)} text-white text-[11px] font-semibold`}
                aria-hidden
              >
                {initials(c.collaborator)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--text-primary)] text-sm leading-tight truncate">
                  {c.collaborator}
                </p>
                <p className="text-[11px] text-[var(--text-tertiary)] leading-tight tnum mt-0.5">
                  Plan. {formatHoursMinutes(c.planned_hours)} · Real.{' '}
                  {formatHoursMinutes(c.realized_hours)} · Leg.{' '}
                  {formatHoursMinutes(c.legacy_hours)}
                </p>
              </div>
            </div>

            <div className="px-5 py-4 space-y-2.5">
              <BarRow
                label="Planejado"
                value={c.planned_hours}
                max={max}
                tone="planned"
              />
              <BarRow
                label="Realizado"
                value={c.realized_hours}
                max={max}
                tone="realized"
              />
              {c.legacy_hours > 0 && (
                <BarRow
                  label="Legado"
                  value={c.legacy_hours}
                  max={max}
                  tone="legacy"
                />
              )}
            </div>

            {c.tasks.length > 0 && (
              <div className="border-t border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
                {c.tasks.map(task => (
                  <div key={task.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider-2 ${KIND_TONE[task.kind].chip}`}
                      >
                        {KIND_LABELS[task.kind]}
                      </span>
                      <span className="text-sm font-semibold tnum text-[var(--text-primary)]">
                        {formatHoursMinutes(task.hours)}
                      </span>
                    </div>
                    {task.content && (
                      <p className="text-sm text-[var(--text-secondary)] mt-2 leading-snug whitespace-pre-line">
                        {task.content}
                      </p>
                    )}
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5 tnum">
                      {formatDate(task.date)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface BarRowProps {
  label: string;
  value: number;
  max: number;
  tone: TicketTaskKind;
}

function BarRow({ label, value, max, tone }: BarRowProps) {
  const t = KIND_TONE[tone];
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-medium text-[var(--text-tertiary)] w-20 shrink-0">
        {label}
      </span>
      <div className={`flex-1 h-1.5 rounded-full ${t.barBg} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${t.bar} transition-[width] duration-700 ease-out`}
          style={{ width: `${pct}%` }}
          role="img"
          aria-label={`${label}: ${formatHoursMinutes(value)}`}
        />
      </div>
      <span className="text-xs font-semibold tnum text-[var(--text-primary)] min-w-[3rem] text-right">
        {formatHoursMinutes(value)}
      </span>
    </div>
  );
}
