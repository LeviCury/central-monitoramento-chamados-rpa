import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Ticket } from '../types';
import { useTheme } from '../contexts/useTheme';
import TicketFilterPanel from './TicketFilterPanel';
import StatusChart from './StatusChart';
import TechnicianChart from './TechnicianChart';
import TypeChart from './TypeChart';
import TimelineChart from './TimelineChart';
import TicketTable from './TicketTable';
import PlannedVsRealizedChart from './PlannedVsRealizedChart';
import TicketDetailPanel from './TicketDetailPanel';
import { Heatmap } from './Heatmap';
import { KPIGrid } from './KPIGrid';
import { DashboardHeader } from './DashboardHeader';
import { PresetsBar } from './PresetsBar';
import { PresentationCarousel } from './PresentationCarousel';
import { InsightsBlock } from './InsightsBlock';
import { ShareMenu } from './ShareMenu';
import { TechniciansCompare } from './TechniciansCompare';
import {
  ActionItem,
  aggregatePlannedVsRealizedByCollaborator,
  aggregateTicketsByDate,
  aggregateTicketsByStatus,
  aggregateTicketsByTechnician,
  aggregateTicketsByType,
  aggregateTicketsHeatmap,
  computeMetricsDelta,
  fetchTickets,
  fetchWorkHoursForTickets,
  generateActionItems,
  generateInsights,
  getPreviousDateRange,
  getTicketMetrics,
  getUniqueStatuses,
  getUniqueTechnicians,
  TicketMetrics,
} from '../services/analytics';
import { useGLPITickets } from '../hooks/useGLPITickets';
import { usePresentationMode } from '../hooks/usePresentationMode';
import { useTimeAgo } from '../hooks/useTimeAgo';
import { useDashboardFilters } from '../hooks/useDashboardFilters';
import { useDrillDown } from '../hooks/useDrillDown';
import { pushToast } from '../hooks/useToasts';
import { config } from '../config';

const MINERVA_LOGO_DARK = 'https://minervafoods.com/wp-content/uploads/2024/08/logo-1920x846.webp';
const MINERVA_LOGO_LIGHT =
  'https://wiki.minervafoods.com/xwiki/bin/download/FlamingoThemes/Simplex/minerva_secundaria_fundo_svg.svg?rev=1.1';

const PRIORITY_OPTIONS = ['Muito Baixa', 'Baixa', 'Média', 'Alta', 'Muito Alta', 'Maior'];

export default function Dashboard() {
  const { isDark } = useTheme();
  const {
    filters,
    setFilters,
    groupId,
    setGroupId,
    presets,
    savePreset,
    applyPreset,
    removePreset,
  } = useDashboardFilters();
  const { presentationMode, tvMode, toggle, toggleTv, ref } = usePresentationMode();
  const { drillStatus, drillTechnician, drillDate, drillType } = useDrillDown(filters, setFilters);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [exporting, setExporting] = useState(false);
  const [previousMetrics, setPreviousMetrics] = useState<TicketMetrics | null>(null);
  const captureRef = useRef<HTMLElement | null>(null);

  const {
    tickets: rawTickets,
    isLoading,
    isFetching,
    isLoadingHours,
    hoursSkipped,
    hoursMaxLimit,
    isError,
    error,
    lastUpdate,
    refetch,
  } = useGLPITickets({ filters, groupId });

  const timeAgo = useTimeAgo(lastUpdate);
  const hasDateFilter = Boolean(filters.dateRange.start && filters.dateRange.end);

  // Filtro "Tipo" aplicado client-side. Vazio = todos.
  const tickets = useMemo(() => {
    const types = filters.types ?? [];
    if (types.length === 0) return rawTickets;
    return rawTickets.filter(t => types.includes(t.type));
  }, [rawTickets, filters.types]);

  const metrics = useMemo(() => getTicketMetrics(tickets), [tickets]);
  const statusData = useMemo(() => aggregateTicketsByStatus(tickets), [tickets]);
  const technicianData = useMemo(() => aggregateTicketsByTechnician(tickets), [tickets]);
  const typeData = useMemo(() => aggregateTicketsByType(tickets), [tickets]);
  const timelineData = useMemo(() => aggregateTicketsByDate(tickets), [tickets]);
  const heatmapData = useMemo(() => aggregateTicketsHeatmap(tickets), [tickets]);
  const plannedVsRealizedData = useMemo(
    () => aggregatePlannedVsRealizedByCollaborator(tickets),
    [tickets]
  );

  const filterOptions = useMemo(
    () => ({
      // Para o painel de filtros, mostramos as opções de status/técnico do
      // dataset bruto — assim não somem ao aplicar o filtro "Tipo".
      statuses: getUniqueStatuses(rawTickets),
      technicians: getUniqueTechnicians(rawTickets),
    }),
    [rawTickets]
  );

  const delta = useMemo(
    () => computeMetricsDelta(metrics, previousMetrics),
    [metrics, previousMetrics]
  );

  const insights = useMemo(() => generateInsights(metrics, delta, tickets), [metrics, delta, tickets]);
  const actionItems = useMemo(() => generateActionItems(tickets, metrics), [tickets, metrics]);

  const handleApplyAction = (item: ActionItem) => {
    if (!item.filter) return;
    setFilters(prev => ({
      ...prev,
      statuses: item.filter?.statuses ?? prev.statuses,
      technicians: item.filter?.technicians ?? prev.technicians,
      types: prev.types ?? [],
    }));
    if (item.filter.staleOnly) {
      pushToast(
        `Filtro aplicado. Ordene a coluna "Data Abertura" para ver os chamados abertos há mais de ${metrics.staleThresholdDays} dias.`,
        'success',
        5000
      );
    } else {
      pushToast('Filtro aplicado', 'success', 2200);
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Notifica auto-refresh
  useEffect(() => {
    if (lastUpdate && Date.now() - lastUpdate.getTime() < 2000 && tickets.length > 0) {
      pushToast('Dados atualizados', 'success', 2200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdate.getTime()]);

  // Carrega métricas do período anterior em background (comparação temporal).
  useEffect(() => {
    let cancelled = false;
    if (!hasDateFilter) {
      setPreviousMetrics(null);
      return () => undefined;
    }
    const prev = getPreviousDateRange(filters.dateRange.start, filters.dateRange.end);
    if (!prev) {
      setPreviousMetrics(null);
      return () => undefined;
    }
    (async () => {
      try {
        const previousTickets = await fetchTickets({
          startDate: prev.start,
          endDate: prev.end,
          statuses: filters.statuses.length > 0 ? filters.statuses : undefined,
          priorities: filters.priorities.length > 0 ? filters.priorities : undefined,
          technicians: filters.technicians.length > 0 ? filters.technicians : undefined,
          groupId,
        });
        if (cancelled) return;
        if (previousTickets.length > 0 && previousTickets.length <= config.ui.maxTicketsForHours) {
          await fetchWorkHoursForTickets(previousTickets);
        }
        if (cancelled) return;
        setPreviousMetrics(getTicketMetrics(previousTickets));
      } catch (err) {
        console.warn('[Dashboard] Falha ao carregar período anterior:', err);
        if (!cancelled) setPreviousMetrics(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    hasDateFilter,
    filters.dateRange.start,
    filters.dateRange.end,
    filters.statuses,
    filters.priorities,
    filters.technicians,
    groupId,
  ]);

  const handleRefresh = () => {
    refetch();
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const { exportToExcel } = await import('../services/excelExport');
      await exportToExcel({
        tickets,
        metrics,
        dateRange: filters.dateRange,
        insights,
        actionItems,
        delta,
      });
      pushToast('Relatório Excel gerado', 'success');
    } catch (err) {
      console.error('Erro ao exportar:', err);
      pushToast('Falha ao exportar relatório', 'error');
    } finally {
      setExporting(false);
    }
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const periodLabel = hasDateFilter
    ? `${formatDateLabel(filters.dateRange.start)} — ${formatDateLabel(filters.dateRange.end)}`
    : 'Visualizando todos os períodos';

  // Loading inicial — Apple-style minimalista
  if (isLoading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
        <div className="ambient-orbs" aria-hidden />
        <div className="relative z-10 text-center px-6 animate-fade-in">
          <img
            src={isDark ? MINERVA_LOGO_LIGHT : MINERVA_LOGO_DARK}
            alt="Minerva Foods"
            className="h-10 mx-auto mb-12 opacity-90"
          />
          <div
            role="status"
            aria-label="Conectando ao GLPI"
            className="flex items-center justify-center gap-1.5 mb-6"
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)] animate-pulse-soft"
              style={{ animationDelay: '0ms' }}
              aria-hidden
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)] animate-pulse-soft"
              style={{ animationDelay: '200ms' }}
              aria-hidden
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)] animate-pulse-soft"
              style={{ animationDelay: '400ms' }}
              aria-hidden
            />
          </div>
          <p className="text-[var(--text-primary)] text-base font-semibold tracking-[-0.01em]">
            Conectando ao GLPI
          </p>
          <p className="text-[var(--text-secondary)] text-sm mt-1.5 max-w-xs mx-auto">
            Carregando dados em tempo real
          </p>
        </div>
      </div>
    );
  }

  // Slides do modo TV
  const tvSlides = [
    {
      id: 'kpis',
      label: 'KPIs',
      content: (
        <KPIGrid
          metrics={metrics}
          delta={delta}
          loadingHours={isLoadingHours}
          hoursSkipped={hoursSkipped}
          hoursMaxLimit={hoursMaxLimit}
          large
        />
      ),
    },
    {
      id: 'timeline',
      label: 'Evolução',
      content: <TimelineChart data={timelineData} showForecast />,
    },
    {
      id: 'planned',
      label: 'Planejado x Realizado',
      content: <PlannedVsRealizedChart data={plannedVsRealizedData} />,
    },
    {
      id: 'mix',
      label: 'Status, Tipo & Técnicos',
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StatusChart data={statusData} />
            <TypeChart data={typeData} />
          </div>
          <TechnicianChart data={technicianData} />
        </div>
      ),
    },
    {
      id: 'heatmap',
      label: 'Heatmap',
      content: <Heatmap data={heatmapData} />,
    },
  ];

  return (
    <div
      ref={ref}
      className={`relative min-h-screen ${presentationMode ? 'bg-minerva-gradient presentation-mode overflow-hidden' : 'bg-[var(--bg-base)]'}`}
    >
      {/* Atmosfera muito sutil — não chamativo */}
      {!presentationMode && <div className="ambient-orbs" aria-hidden />}

      <DashboardHeader
        presentationMode={presentationMode}
        onTogglePresentation={toggle}
        refreshing={isFetching && !isLoading}
        exporting={exporting}
        onRefresh={handleRefresh}
        onExport={handleExportExcel}
        ticketsCount={tickets.length}
        periodLabel={periodLabel}
        timeAgo={timeAgo}
        groupId={groupId}
        onGroupChange={setGroupId}
        extraActions={
          <ShareMenu
            getCaptureTarget={() => captureRef.current}
            metrics={metrics}
            insights={insights}
            actionItems={actionItems}
            periodLabel={periodLabel}
            groupName={config.groups.find(g => g.id === groupId)?.name}
            delta={delta}
            statusBreakdown={statusData}
            technicianBreakdown={technicianData}
          />
        }
      />

      {presentationMode && (
        <div
          className="fixed bottom-4 right-4 z-40 flex items-center gap-3 px-4 py-2 rounded-full bg-black/60 backdrop-blur text-white text-xs font-medium shadow-lg pointer-events-auto"
          role="status"
          aria-live="polite"
        >
          <button
            type="button"
            onClick={toggleTv}
            aria-pressed={tvMode}
            className={`px-3 py-1 rounded-full transition-colors ${
              tvMode
                ? 'bg-emerald-500/80 hover:bg-emerald-500 text-white'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={tvMode ? 'Pausar slideshow (T)' : 'Iniciar slideshow (T)'}
          >
            {tvMode ? '⏸ Slideshow ativo' : '▶ Iniciar slideshow'}
          </button>
          <span className="opacity-70">T alterna · Esc sai</span>
        </div>
      )}

      <main
        ref={captureRef}
        className={`relative z-10 ${presentationMode ? 'px-10 py-8' : 'max-w-[1400px] mx-auto px-8 py-10'}`}
      >
        {/* Erro */}
        {isError && !presentationMode && (
          <div
            role="alert"
            className="mb-10 p-5 surface-elevated border-rose-500/20 bg-rose-500/[0.04] dark:bg-rose-500/[0.06] flex items-center gap-4 animate-fade-in"
          >
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertCircle className="w-5 h-5" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[var(--text-primary)] font-semibold text-sm">
                Erro ao carregar dados
              </p>
              <p className="text-[var(--text-secondary)] text-xs mt-0.5 truncate">
                {(error as Error)?.message ?? 'Erro desconhecido'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="primary-btn"
            >
              <RefreshCw className="w-4 h-4" aria-hidden />
              Tentar novamente
            </button>
          </div>
        )}

        {/* Modo TV: carrossel de slides */}
        {presentationMode && tvMode ? (
          <PresentationCarousel slides={tvSlides} active />
        ) : (
          <>
            {/* KPIs */}
            <div className={presentationMode ? 'mb-8' : 'mb-10'} data-export="kpis">
              <KPIGrid
                metrics={metrics}
                delta={delta}
                loadingHours={isLoadingHours}
                hoursSkipped={hoursSkipped}
                hoursMaxLimit={hoursMaxLimit}
                large={presentationMode}
              />
            </div>

            {!presentationMode && (
              <div className="mb-10">
                <InsightsBlock
                  insights={insights}
                  actionItems={actionItems}
                  onApplyAction={handleApplyAction}
                />
              </div>
            )}

            {!presentationMode && (
              <div className="mb-10">
                <PresetsBar
                  presets={presets}
                  onApply={applyPreset}
                  onSave={savePreset}
                  onRemove={removePreset}
                />
              </div>
            )}

            {!presentationMode ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-10">
                <div className="lg:col-span-1 animate-slide-in">
                  <TicketFilterPanel
                    filters={filters}
                    statuses={filterOptions.statuses}
                    priorities={PRIORITY_OPTIONS}
                    technicians={filterOptions.technicians}
                    onFilterChange={setFilters}
                  />
                </div>

                <div className="lg:col-span-3 space-y-8">
                  <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <TimelineChart
                      data={timelineData}
                      onSelectDate={drillDate}
                      showForecast={hasDateFilter}
                    />
                  </div>

                  <div className="animate-fade-in" style={{ animationDelay: '0.15s' }}>
                    <PlannedVsRealizedChart data={plannedVsRealizedData} />
                  </div>

                  <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                    <Heatmap data={heatmapData} />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="animate-fade-in" style={{ animationDelay: '0.25s' }}>
                      <StatusChart
                        data={statusData}
                        onSelectStatus={drillStatus}
                        selectedStatuses={filters.statuses}
                      />
                    </div>
                    <div className="animate-fade-in" style={{ animationDelay: '0.28s' }}>
                      <TypeChart
                        data={typeData}
                        onSelectType={drillType}
                        selectedTypes={filters.types}
                      />
                    </div>
                    <div className="animate-fade-in lg:col-span-2" style={{ animationDelay: '0.3s' }}>
                      <TechnicianChart
                        data={technicianData}
                        onSelectTechnician={drillTechnician}
                        selectedTechnicians={filters.technicians}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <TimelineChart data={timelineData} />
                <PlannedVsRealizedChart data={plannedVsRealizedData} />
                <Heatmap data={heatmapData} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <StatusChart data={statusData} />
                  <TypeChart data={typeData} />
                </div>
                <TechnicianChart data={technicianData} />
              </div>
            )}

            {!presentationMode && (
              <div className="animate-fade-in mb-10" style={{ animationDelay: '0.35s' }}>
                <TechniciansCompare
                  tickets={tickets}
                  technicians={filterOptions.technicians}
                />
              </div>
            )}

            {!presentationMode && (
              <div className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
                <TicketTable tickets={tickets} onSelectTicket={setSelectedTicket} />
              </div>
            )}
          </>
        )}

        {!presentationMode && (
          <footer className="mt-16 pt-10 border-t border-[var(--border-subtle)]">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex items-center gap-3">
                <img
                  src={isDark ? MINERVA_LOGO_LIGHT : MINERVA_LOGO_DARK}
                  alt="Minerva Foods"
                  className="h-7 opacity-80"
                />
                <div className="h-5 w-px bg-[var(--border-default)]" aria-hidden />
                <span className="text-[var(--text-tertiary)] text-xs font-medium">
                  Central de Monitoramento de Chamados RPA
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-center text-xs">
                <span className="text-[var(--text-tertiary)]">Desenvolvido por</span>
                <a
                  href="https://www.linkedin.com/in/levicury/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors underline-offset-4 hover:underline"
                >
                  Levi Cury
                </a>
                <span className="text-[var(--text-tertiary)]">·</span>
                <a
                  href="https://www.linkedin.com/in/igor-minuncio/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors underline-offset-4 hover:underline"
                >
                  Igor Martins Minuncio
                </a>
              </div>

              <p className="text-[var(--text-tertiary)] text-[11px]">
                © {new Date().getFullYear()} Minerva Foods S.A. — Todos os direitos reservados
              </p>
            </div>
          </footer>
        )}

        {presentationMode && (
          <div className="fixed bottom-4 left-0 right-0 flex justify-center pointer-events-none">
            <div className="flex items-center gap-4 px-5 py-2.5 bg-black/30 backdrop-blur-sm rounded-full pointer-events-auto">
              <img src={MINERVA_LOGO_LIGHT} alt="Minerva Foods" className="h-5 opacity-90" />
              <div className="h-4 w-px bg-white/20" aria-hidden />
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
                <span className="text-white/60 text-xs">Atualizado {timeAgo}</span>
              </div>
              <div className="h-4 w-px bg-white/20" aria-hidden />
              <span className="text-white/50 text-xs">
                T = TV · Esc = sair · Ctrl+P = apresentar
              </span>
            </div>
          </div>
        )}
      </main>

      <TicketDetailPanel ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
    </div>
  );
}
