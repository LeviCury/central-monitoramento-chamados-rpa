import { useState, useEffect, useRef, useCallback } from 'react';
import { Ticket, FilterState } from '../types';
import { RefreshCw, AlertCircle, TrendingUp, Clock, CheckCircle, Users, Moon, Sun, Minimize2, Monitor, Download } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import TicketFilterPanel from './TicketFilterPanel';
import StatusChart from './StatusChart';
import TechnicianChart from './TechnicianChart';
import TimelineChart from './TimelineChart';
import TicketTable from './TicketTable';
import {
  fetchTickets,
  fetchWorkHoursForTickets,
  getTicketMetrics,
  aggregateTicketsByStatus,
  aggregateTicketsByTechnician,
  aggregateTicketsByDate,
  getUniqueTechnicians,
  getUniqueStatuses,
} from '../services/analytics';
import { exportToExcel } from '../services/excelExport';

// Logos da Minerva Foods
const MINERVA_LOGO_DARK = 'https://minervafoods.com/wp-content/uploads/2024/08/logo-1920x846.webp'; // Logo colorida (para fundo claro)
const MINERVA_LOGO_LIGHT = 'https://wiki.minervafoods.com/xwiki/bin/download/FlamingoThemes/Simplex/minerva_secundaria_fundo_svg.svg?rev=1.1'; // Logo branca (para fundo escuro)

// Intervalo de auto-refresh em minutos
const AUTO_REFRESH_INTERVAL = 20;

export default function Dashboard() {
  const { theme, toggleTheme, isDark } = useTheme();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHours, setLoadingHours] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [timeAgo, setTimeAgo] = useState<string>('agora');
  const [exporting, setExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState<FilterState>({
    dateRange: { start: '', end: '' },
    statuses: [],
    priorities: [],
    technicians: [],
  });

  const [filterOptions, setFilterOptions] = useState({
    statuses: [] as string[],
    technicians: [] as string[],
  });

  const hasDateFilter = filters.dateRange.start && filters.dateRange.end;

  const loadData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    
    setError(null);

    try {
      const ticketsData = await fetchTickets(
        filters.dateRange.start || undefined,
        filters.dateRange.end || undefined,
        filters.statuses.length > 0 ? filters.statuses : undefined,
        undefined,
        filters.technicians.length > 0 ? filters.technicians : undefined
      );

      setTickets(ticketsData);

      if (ticketsData.length > 0) {
        setFilterOptions({
          statuses: getUniqueStatuses(ticketsData),
          technicians: getUniqueTechnicians(ticketsData),
        });
      }

      if (hasDateFilter && ticketsData.length > 0 && ticketsData.length <= 100) {
        setLoadingHours(true);
        try {
          await fetchWorkHoursForTickets(ticketsData);
          setTickets([...ticketsData]);
        } catch (hoursError) {
          console.warn('Erro ao buscar horas trabalhadas:', hoursError);
        } finally {
          setLoadingHours(false);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar tickets';
      console.error('Error loading tickets:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastUpdate(new Date());
      setTimeAgo('agora');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Função para calcular tempo decorrido
  const calculateTimeAgo = useCallback(() => {
    const now = new Date();
    const diffMs = now.getTime() - lastUpdate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
      return 'agora';
    } else if (diffMins === 1) {
      return 'há 1 minuto';
    } else if (diffMins < 60) {
      return `há ${diffMins} minutos`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours === 1) {
        return 'há 1 hora';
      }
      return `há ${diffHours} horas`;
    }
  }, [lastUpdate]);

  // Atualizar o "tempo atrás" a cada 30 segundos
  useEffect(() => {
    const updateTimeAgo = () => {
      setTimeAgo(calculateTimeAgo());
    };

    const interval = setInterval(updateTimeAgo, 30000);
    return () => clearInterval(interval);
  }, [calculateTimeAgo]);

  // Auto-refresh a cada X minutos
  useEffect(() => {
    if (!loading) {
      const interval = setInterval(() => {
        console.log(`Auto-refresh executado (${AUTO_REFRESH_INTERVAL} min)`);
        loadData(true);
      }, AUTO_REFRESH_INTERVAL * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [loading, filters]);

  useEffect(() => {
    if (!loading) {
      loadData(true);
    }
  }, [filters]);

  const handleRefresh = () => {
    loadData(true);
  };

  // Exportar para Excel
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const currentMetrics = getTicketMetrics(tickets);
      await exportToExcel({
        tickets,
        metrics: currentMetrics,
        dateRange: filters.dateRange,
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('Erro ao exportar relatório. Tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  // Modo Apresentação
  const togglePresentationMode = useCallback(async () => {
    if (!presentationMode) {
      // Entrar em modo apresentação
      try {
        if (dashboardRef.current?.requestFullscreen) {
          await dashboardRef.current.requestFullscreen();
        }
      } catch (err) {
        console.log('Fullscreen não suportado, usando modo simulado');
      }
      setPresentationMode(true);
    } else {
      // Sair do modo apresentação
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch (err) {
        console.log('Erro ao sair do fullscreen');
      }
      setPresentationMode(false);
    }
  }, [presentationMode]);

  // Listener para detectar saída do fullscreen (ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && presentationMode) {
        setPresentationMode(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [presentationMode]);

  // Atalho de teclado (F11 ou P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' && e.ctrlKey) {
        e.preventDefault();
        togglePresentationMode();
      }
      if (e.key === 'Escape' && presentationMode) {
        setPresentationMode(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePresentationMode, presentationMode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-minerva-gradient flex items-center justify-center">
        <div className="text-center">
          <img 
            src={MINERVA_LOGO_LIGHT} 
            alt="Minerva Foods" 
            className="h-16 mx-auto mb-8 animate-pulse-slow"
          />
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-minerva-red mx-auto mb-4"></div>
          <p className="text-white font-medium">Conectando ao GLPI...</p>
          <p className="text-white/60 text-sm mt-2">Carregando dados dos chamados</p>
        </div>
      </div>
    );
  }

  const metrics = getTicketMetrics(tickets);
  const statusData = aggregateTicketsByStatus(tickets);
  const technicianData = aggregateTicketsByTechnician(tickets);
  const timelineData = aggregateTicketsByDate(tickets);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };
  
  const periodLabel = hasDateFilter
    ? `${formatDate(filters.dateRange.start)} — ${formatDate(filters.dateRange.end)}`
    : 'Visualizando todos os períodos';

  return (
    <div 
      ref={dashboardRef}
      className={`min-h-screen bg-minerva-gradient-light dark:bg-slate-900 ${presentationMode ? 'presentation-mode' : ''}`}
    >
      {/* Header Premium */}
      <header className={`bg-minerva-navy shadow-minerva-lg ${presentationMode ? '' : 'sticky top-0'} z-50`}>
        <div className={`${presentationMode ? 'px-8' : 'max-w-7xl mx-auto px-6'} py-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <img 
                src={MINERVA_LOGO_LIGHT} 
                alt="Minerva Foods" 
                className={`${presentationMode ? 'h-14' : 'h-10'} object-contain transition-all`}
              />
              <div className={`${presentationMode ? 'h-10' : 'h-8'} w-px bg-white/20`}></div>
              <div>
                <h1 className={`${presentationMode ? 'text-2xl' : 'text-xl'} font-bold text-white tracking-tight transition-all`}>
                  Central de Monitoramento de Chamados RPA
                </h1>
                <div className={`flex items-center gap-3 ${presentationMode ? 'text-base' : 'text-sm'}`}>
                  <p className="text-white/60">
                    {periodLabel}
                  </p>
                  <span className="text-white/30">•</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                    <span className="text-white/60">
                      Atualizado {timeAgo}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Modo Apresentação Toggle */}
              <button
                onClick={togglePresentationMode}
                className={`flex items-center justify-center gap-2 ${presentationMode ? 'px-4 py-2.5' : 'w-10 h-10'} bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white transition-all hover:scale-105`}
                title={presentationMode ? 'Sair do Modo Apresentação (ESC)' : 'Modo Apresentação (Ctrl+P)'}
              >
                {presentationMode ? (
                  <>
                    <Minimize2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Sair</span>
                  </>
                ) : (
                  <Monitor className="w-5 h-5" />
                )}
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white transition-all hover:scale-105"
                title={isDark ? 'Modo Claro' : 'Modo Escuro'}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              {!presentationMode && (
                <>
                  {/* Exportar Excel */}
                  <button
                    onClick={handleExportExcel}
                    disabled={exporting || tickets.length === 0}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl text-white font-medium transition-all disabled:opacity-50 hover:scale-105"
                    title="Exportar relatório para Excel"
                  >
                    <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
                    {exporting ? 'Exportando...' : 'Excel'}
                  </button>

                  {/* Atualizar */}
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all disabled:opacity-50 hover:scale-105"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Atualizando...' : 'Atualizar'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className={`${presentationMode ? 'px-8 py-6' : 'max-w-7xl mx-auto px-6 py-8'}`}>
        {/* Mensagem de erro */}
        {error && !presentationMode && (
          <div className="mb-8 p-5 bg-minerva-red/10 dark:bg-minerva-red/20 border border-minerva-red/30 rounded-2xl flex items-center gap-4 animate-fade-in">
            <div className="p-3 bg-minerva-red/20 rounded-xl">
              <AlertCircle className="w-6 h-6 text-minerva-red" />
            </div>
            <div>
              <p className="text-minerva-navy dark:text-white font-semibold">Erro ao carregar dados</p>
              <p className="text-minerva-navy/70 dark:text-white/70 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* KPIs Premium */}
        <div className={`grid grid-cols-1 md:grid-cols-2 ${hasDateFilter ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6 ${presentationMode ? 'mb-6' : 'mb-8'}`}>
          <KPICard
            title="Total de Chamados"
            value={metrics.total}
            subtitle={`${metrics.inProgress || 0} em atendimento`}
            icon={<TrendingUp className={presentationMode ? "w-8 h-8" : "w-6 h-6"} />}
            color="navy"
            delay={0}
            large={presentationMode}
          />
          <KPICard
            title="Taxa de Resolução"
            value={`${metrics.closureRate}%`}
            subtitle={`${metrics.closed + metrics.solved} finalizados`}
            icon={<CheckCircle className={presentationMode ? "w-8 h-8" : "w-6 h-6"} />}
            color="green"
            delay={1}
            large={presentationMode}
          />
          <KPICard
            title="Chamados em Aberto"
            value={metrics.inProgress + metrics.pending + metrics.newTickets}
            subtitle={`${metrics.pending} aguardando ação`}
            icon={<Users className={presentationMode ? "w-8 h-8" : "w-6 h-6"} />}
            color="amber"
            delay={2}
            large={presentationMode}
          />
          
          {hasDateFilter && (
            <KPICard
              title="Média de Horas"
              value={loadingHours ? '...' : `${metrics.avgWorkHours}h`}
              subtitle={loadingHours ? 'Calculando...' : `${metrics.totalWorkHours}h trabalhadas`}
              icon={<Clock className={presentationMode ? "w-8 h-8" : "w-6 h-6"} />}
              color="red"
              delay={3}
              large={presentationMode}
            />
          )}
        </div>

        {/* Content Grid - Modo Normal */}
        {!presentationMode && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            {/* Filtros */}
            <div className="lg:col-span-1 animate-slide-in">
              <TicketFilterPanel
                filters={filters}
                statuses={filterOptions.statuses}
                priorities={[]}
                technicians={filterOptions.technicians}
                onFilterChange={setFilters}
              />
            </div>

            {/* Gráficos */}
            <div className="lg:col-span-3 space-y-6">
              <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <TimelineChart data={timelineData} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                  <StatusChart data={statusData} />
                </div>
                <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
                  <TechnicianChart data={technicianData} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gráficos - Modo Apresentação */}
        {presentationMode && (
          <div className="space-y-6">
            <div className="animate-fade-in">
              <TimelineChart data={timelineData} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="animate-fade-in">
                <StatusChart data={statusData} />
              </div>
              <div className="animate-fade-in">
                <TechnicianChart data={technicianData} />
              </div>
            </div>
          </div>
        )}

        {/* Tabela de Chamados - Apenas no modo normal */}
        {!presentationMode && (
          <div className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <TicketTable tickets={tickets} />
          </div>
        )}

        {/* Footer - Apenas no modo normal */}
        {!presentationMode && (
        <footer className="mt-12 pt-8 border-t border-minerva-navy/10 dark:border-white/10">
          <div className="flex flex-col items-center gap-5">
            {/* Logo e título */}
            <div className="flex items-center gap-3">
              <img 
                src={isDark ? MINERVA_LOGO_LIGHT : MINERVA_LOGO_DARK} 
                alt="Minerva Foods" 
                className="h-8 opacity-80"
              />
              <div className="h-6 w-px bg-minerva-navy/10 dark:bg-white/20"></div>
              <span className="text-minerva-navy/50 dark:text-white/50 text-sm">
                Central de Monitoramento de Chamados RPA
              </span>
            </div>
            
            {/* Desenvolvedores */}
            <div className="flex items-center gap-3">
              <span className="text-minerva-navy/40 dark:text-white/40 text-sm">Desenvolvido por</span>
              <div className="flex items-center gap-2">
                <a 
                  href="https://www.linkedin.com/in/levicury/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-minerva-navy/5 dark:bg-white/10 hover:bg-minerva-navy hover:text-white rounded-lg text-minerva-navy dark:text-white text-sm font-medium transition-all"
                >
                  Levi Cury
                  <svg className="w-3.5 h-3.5 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                </a>
                <span className="text-minerva-navy/30 dark:text-white/30">&</span>
                <a 
                  href="https://www.linkedin.com/in/igor-minuncio/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-minerva-navy/5 dark:bg-white/10 hover:bg-minerva-navy hover:text-white rounded-lg text-minerva-navy dark:text-white text-sm font-medium transition-all"
                >
                  Igor Martins Minuncio
                  <svg className="w-3.5 h-3.5 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Copyright */}
            <p className="text-minerva-navy/30 dark:text-white/30 text-xs">
              © {new Date().getFullYear()} Minerva Foods S.A. — Todos os direitos reservados
            </p>
          </div>
        </footer>
        )}

        {/* Rodapé minimalista no modo apresentação */}
        {presentationMode && (
          <div className="fixed bottom-4 left-0 right-0 flex justify-center">
            <div className="flex items-center gap-4 px-5 py-2.5 bg-black/30 backdrop-blur-sm rounded-full">
              <img 
                src={MINERVA_LOGO_LIGHT} 
                alt="Minerva Foods" 
                className="h-5 opacity-90"
              />
              <div className="h-4 w-px bg-white/20"></div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                <span className="text-white/60 text-xs">
                  Atualizado {timeAgo}
                </span>
              </div>
              <div className="h-4 w-px bg-white/20"></div>
              <span className="text-white/50 text-xs">
                ESC para sair
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Componente KPI Card Premium
interface KPICardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  color: 'navy' | 'green' | 'amber' | 'red';
  delay: number;
  large?: boolean;
}

function KPICard({ title, value, subtitle, icon, color, delay, large = false }: KPICardProps) {
  const colorStyles = {
    navy: {
      bg: 'bg-gradient-to-br from-minerva-navy to-minerva-navy-light',
      iconBg: 'bg-white/20',
      text: 'text-white',
      subtext: 'text-white/70',
    },
    green: {
      bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      iconBg: 'bg-white/20',
      text: 'text-white',
      subtext: 'text-white/70',
    },
    amber: {
      bg: 'bg-gradient-to-br from-amber-400 to-amber-500',
      iconBg: 'bg-white/20',
      text: 'text-white',
      subtext: 'text-white/70',
    },
    red: {
      bg: 'bg-gradient-to-br from-minerva-red to-minerva-red-dark',
      iconBg: 'bg-white/20',
      text: 'text-white',
      subtext: 'text-white/70',
    },
  };

  const styles = colorStyles[color];

  return (
    <div 
      className={`${styles.bg} rounded-2xl ${large ? 'p-8' : 'p-6'} shadow-minerva-lg card-hover animate-fade-in transition-all`}
      style={{ animationDelay: `${delay * 0.1}s` }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`${large ? 'text-base' : 'text-sm'} font-medium ${styles.subtext} mb-1`}>{title}</p>
          <p className={`${large ? 'text-5xl' : 'text-4xl'} font-bold ${styles.text} tracking-tight`}>
            {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
          </p>
          <p className={`${large ? 'text-base' : 'text-sm'} ${styles.subtext} mt-2`}>{subtitle}</p>
        </div>
        <div className={`${large ? 'p-4' : 'p-3'} ${styles.iconBg} rounded-xl ${styles.text}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
