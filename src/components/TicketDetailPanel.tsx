import { X, ExternalLink, Clock, AlertTriangle, FileText } from 'lucide-react';
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
  if (!ticket) return null;

  const hasPendingNote =
    ticket.hours_status === 'missing_planned' ||
    ticket.hours_status === 'missing_realized' ||
    ticket.hours_status === 'missing_both';

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button
        type="button"
        aria-label="Fechar detalhes"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
      />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white dark:bg-slate-900 shadow-2xl animate-slide-in">
        <div className="sticky top-0 z-10 bg-minerva-navy px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-white/60 text-sm font-mono">#{ticket.id}</p>
              <h2 className="text-xl font-bold text-white mt-1">{ticket.title}</h2>
              <a
                href={`${GLPI_BASE_URL}${ticket.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mt-3"
              >
                Abrir no GLPI
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-blue-50 dark:bg-blue-500/10 p-4">
              <p className="text-xs text-blue-600 dark:text-blue-300 font-semibold uppercase">Planejado</p>
              <p className="text-3xl font-bold text-minerva-navy dark:text-white mt-2">
                {formatHoursMinutes(ticket.planned_time_hours)}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 p-4">
              <p className="text-xs text-emerald-600 dark:text-emerald-300 font-semibold uppercase">Realizado</p>
              <p className="text-3xl font-bold text-minerva-navy dark:text-white mt-2">
                {formatHoursMinutes(ticket.realized_time_hours)}
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 p-4">
              <p className="text-xs text-amber-600 dark:text-amber-300 font-semibold uppercase">Legado</p>
              <p className="text-3xl font-bold text-minerva-navy dark:text-white mt-2">
                {formatHoursMinutes(ticket.legacy_time_hours)}
              </p>
            </div>
          </section>

          <section className={`rounded-2xl border p-4 ${
            hasPendingNote
              ? 'border-minerva-red/30 bg-minerva-red/10 dark:bg-minerva-red/20'
              : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800'
          }`}>
            <div className="flex items-center gap-3">
              {hasPendingNote ? (
                <AlertTriangle className="w-5 h-5 text-minerva-red" />
              ) : (
                <Clock className="w-5 h-5 text-minerva-navy dark:text-white" />
              )}
              <p className="font-semibold text-minerva-navy dark:text-white">
                {STATUS_LABELS[ticket.hours_status]}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
              <h3 className="font-semibold text-minerva-navy dark:text-white">Resumo do chamado</h3>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Status</p>
                <p className="text-minerva-navy dark:text-white font-medium">{ticket.status}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Técnico responsável</p>
                <p className="text-minerva-navy dark:text-white font-medium">{ticket.assigned_technician}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Solicitante</p>
                <p className="text-minerva-navy dark:text-white font-medium">{ticket.requester}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Data abertura</p>
                <p className="text-minerva-navy dark:text-white font-medium">{formatDate(ticket.opened_date)}</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-minerva-red" />
              <h3 className="font-semibold text-minerva-navy dark:text-white">Apontamentos por colaborador</h3>
            </div>

            {ticket.collaborator_hours.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 dark:border-slate-600 p-8 text-center text-gray-400 dark:text-gray-500">
                Nenhum apontamento dos colaboradores RPA permitidos foi encontrado.
              </div>
            ) : (
              ticket.collaborator_hours.map(collaborator => (
                <div key={collaborator.collaborator} className="rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 dark:bg-slate-800">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <p className="font-semibold text-minerva-navy dark:text-white">{collaborator.collaborator}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Plan. {formatHoursMinutes(collaborator.planned_hours)} | Real. {formatHoursMinutes(collaborator.realized_hours)} | Leg. {formatHoursMinutes(collaborator.legacy_hours)}
                      </p>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-slate-700">
                    {collaborator.tasks.map(task => (
                      <div key={task.id} className="p-5">
                        <div className="flex items-center justify-between gap-4">
                          <span className="inline-flex rounded-full bg-minerva-navy/10 dark:bg-white/10 px-3 py-1 text-xs font-semibold text-minerva-navy dark:text-white">
                            {KIND_LABELS[task.kind]}
                          </span>
                          <span className="text-lg font-bold text-minerva-navy dark:text-white">{formatHoursMinutes(task.hours)}</span>
                        </div>
                        {task.content && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">{task.content}</p>
                        )}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{formatDate(task.date)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
