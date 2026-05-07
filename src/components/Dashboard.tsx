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

  const { tickets: rawTickets, isLoading, isFetching, isLoadingHours, isError, error, lastUpdate, refetch } =
    useGLPITickets({ filters, groupId });

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

  const insights = useMemo(() => generateInsights(metrics, delta), [metrics, delta]);
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

  // Loading inicial
  if (isLoading) {
    return (
      <div className="min-h-screen bg-minerva-gradient flex items-center justify-center">
        <div className="text-center">
          <img
            src={MINERVA_LOGO_LIGHT}
            alt="Minerva Foods"
            className="h-16 mx-auto mb-8 animate-pulse-slow"
          />
          <div
            className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-minerva-red mx-auto mb-4"
            role="status"
            aria-label="Carregando"
          />
          <p className="text-white font-medium">Conectando ao GLPI...</p>
          <p className="text-white/60 text-sm mt-2">Carregando dados dos chamados</p>
        </div>
      </div>
    );
  }

  // Slides do modo TV
  const tvSlides = [
    {
      id: 'kpis',
      label: 'KPIs',
      content: <KPIGrid metrics={metrics} delta={delta} loadingHours={isLoadingHours} large />,
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
      className={`min-h-screen bg-minerva-gradient-light dark:bg-slate-900 ${presentationMode ? 'presentation-mode' : ''}`}
    >
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
        className={`${presentationMode ? 'px-8 py-6' : 'max-w-7xl mx-auto px-6 py-8'} bg-minerva-gradient-light dark:bg-slate-900`}
      >
        {/* Erro */}
        {isError && !presentationMode && (
          <div
            role="alert"
            className="mb-8 p-5 bg-minerva-red/10 dark:bg-minerva-red/20 border border-minerva-red/30 rounded-2xl flex items-center gap-4 animate-fade-in"
          >
            <div className="p-3 bg-minerva-red/20 rounded-xl">
              <AlertCircle className="w-6 h-6 text-minerva-red" aria-hidden />
            </div>
            <div className="flex-1">
              <p className="text-minerva-navy dark:text-white font-semibold">
                Erro ao carregar dados
              </p>
              <p className="text-minerva-navy/70 dark:text-white/70 text-sm">
                {(error as Error)?.message ?? 'Erro desconhecido'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 bg-minerva-red text-white rounded-xl font-medium hover:bg-minerva-red-dark"
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
            <div className={presentationMode ? 'mb-6' : 'mb-8'} data-export="kpis">
              <KPIGrid
                metrics={metrics}
                delta={delta}
                loadingHours={isLoadingHours}
                large={presentationMode}
              />
            </div>

            {!presentationMode && (
              <InsightsBlock
                insights={insights}
                actionItems={actionItems}
                onApplyAction={handleApplyAction}
              />
            )}

            {!presentationMode && (
              <div className="mb-6">
                <PresetsBar
                  presets={presets}
                  onApply={applyPreset}
                  onSave={savePreset}
                  onRemove={removePreset}
                />
              </div>
            )}

            {!presentationMode ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                <div className="lg:col-span-1 animate-slide-in">
                  <TicketFilterPanel
                    filters={filters}
                    statuses={filterOptions.statuses}
                    priorities={PRIORITY_OPTIONS}
                    technicians={filterOptions.technicians}
                    onFilterChange={setFilters}
                  />
                </div>

                <div className="lg:col-span-3 space-y-6">
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
              <div className="space-y-6">
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
              <div className="animate-fade-in mb-6" style={{ animationDelay: '0.35s' }}>
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
          <footer className="mt-12 pt-8 border-t border-minerva-navy/10 dark:border-white/10">
            <div className="flex flex-col items-center gap-5">
              <div className="flex items-center gap-3">
                <img
                  src={isDark ? MINERVA_LOGO_LIGHT : MINERVA_LOGO_DARK}
                  alt="Minerva Foods"
                  className="h-8 opacity-80"
                />
                <div className="h-6 w-px bg-minerva-navy/10 dark:bg-white/20" aria-hidden />
                <span className="text-minerva-navy/50 dark:text-white/50 text-sm">
                  Central de Monitoramento de Chamados RPA
                </span>
              </div>

              <div className="flex items-center gap-3 flex-wrap justify-center">
                <span className="text-minerva-navy/40 dark:text-white/40 text-sm">
                  Desenvolvido por
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href="https://www.linkedin.com/in/levicury/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 bg-minerva-navy/5 dark:bg-white/10 hover:bg-minerva-navy hover:text-white rounded-lg text-minerva-navy dark:text-white text-sm font-medium transition-all"
                  >
                    Levi Cury
                  </a>
                  <span className="text-minerva-navy/30 dark:text-white/30">&</span>
                  <a
                    href="https://www.linkedin.com/in/igor-minuncio/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 bg-minerva-navy/5 dark:bg-white/10 hover:bg-minerva-navy hover:text-white rounded-lg text-minerva-navy dark:text-white text-sm font-medium transition-all"
                  >
                    Igor Martins Minuncio
                  </a>
                </div>
              </div>

              <p className="text-minerva-navy/30 dark:text-white/30 text-xs">
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
