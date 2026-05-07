import {
  Download,
  Filter,
  Minimize2,
  Monitor,
  Moon,
  RefreshCw,
  RotateCcw,
  Sun,
} from 'lucide-react';
import { ReactNode } from 'react';
import { useTheme } from '../contexts/useTheme';
import { config } from '../config';

const MINERVA_LOGO_LIGHT =
  'https://wiki.minervafoods.com/xwiki/bin/download/FlamingoThemes/Simplex/minerva_secundaria_fundo_svg.svg?rev=1.1';

interface DashboardHeaderProps {
  presentationMode: boolean;
  onTogglePresentation: () => void;
  refreshing: boolean;
  exporting: boolean;
  onRefresh: () => void;
  onExport: () => void;
  ticketsCount: number;
  periodLabel: string;
  timeAgo: string;
  groupId: string;
  onGroupChange: (id: string) => void;
  /** Slot opcional para ações extras (ex: botão Compartilhar). */
  extraActions?: ReactNode;
}

export function DashboardHeader({
  presentationMode,
  onTogglePresentation,
  refreshing,
  exporting,
  onRefresh,
  onExport,
  ticketsCount,
  periodLabel,
  timeAgo,
  groupId,
  onGroupChange,
  extraActions,
}: DashboardHeaderProps) {
  const { toggleTheme, isDark } = useTheme();
  const groups = config.groups;
  const activeGroup = groups.find(g => g.id === groupId) ?? { id: groupId, name: `Grupo ${groupId}` };
  const isDefaultGroup = groupId === config.glpi.defaultGroupId;

  return (
    <header
      className={`bg-minerva-navy shadow-minerva-lg ${presentationMode ? '' : 'sticky top-0'} z-50`}
    >
      <div className={`${presentationMode ? 'px-8' : 'max-w-7xl mx-auto px-6'} py-4`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <img
              src={MINERVA_LOGO_LIGHT}
              alt="Minerva Foods"
              className={`${presentationMode ? 'h-14' : 'h-10'} object-contain transition-all`}
            />
            <div className={`${presentationMode ? 'h-10' : 'h-8'} w-px bg-white/20`} aria-hidden />
            <div className="min-w-0">
              <h1
                className={`${presentationMode ? 'text-2xl' : 'text-xl'} font-bold text-white tracking-tight transition-all truncate`}
              >
                Central de Monitoramento de Chamados RPA
              </h1>
              <div className={`flex items-center gap-3 ${presentationMode ? 'text-base' : 'text-sm'} flex-wrap`}>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold tracking-wide ${
                    isDefaultGroup
                      ? 'bg-emerald-500/15 border-emerald-300/30 text-emerald-100'
                      : 'bg-amber-500/20 border-amber-300/40 text-amber-100'
                  }`}
                  title={
                    isDefaultGroup
                      ? `Filtrando pela fila padrão (grupo ${activeGroup.id})`
                      : `Você está vendo o grupo ${activeGroup.name} (${activeGroup.id}), não o padrão`
                  }
                >
                  <Filter className="w-3 h-3" aria-hidden />
                  Fila: {activeGroup.name}
                  {!isDefaultGroup && (
                    <button
                      type="button"
                      onClick={() => onGroupChange(config.glpi.defaultGroupId)}
                      className="ml-1 hover:underline"
                      aria-label="Voltar para a fila padrão"
                      title="Voltar para a fila padrão"
                    >
                      <RotateCcw className="w-3 h-3 inline" aria-hidden />
                    </button>
                  )}
                </span>
                <p className="text-white/60">{periodLabel}</p>
                <span className="text-white/30">•</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
                  <span className="text-white/60">Atualizado {timeAgo}</span>
                </div>
                <span className="text-white/30">•</span>
                <span className="text-white/60">{ticketsCount.toLocaleString('pt-BR')} chamados</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Seletor de grupo */}
            {groups.length > 1 && (
              <label className="sr-only" htmlFor="group-selector">
                Selecionar grupo técnico
              </label>
            )}
            {groups.length > 1 && (
              <select
                id="group-selector"
                value={groupId}
                onChange={e => onGroupChange(e.target.value)}
                aria-label="Grupo técnico"
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id} className="text-minerva-navy">
                    {g.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={onTogglePresentation}
              aria-label={
                presentationMode
                  ? 'Sair do modo apresentação (Esc)'
                  : 'Entrar no modo apresentação (Ctrl+P)'
              }
              title={
                presentationMode
                  ? 'Sair (Esc)'
                  : 'Apresentação (Ctrl+P) — dentro dela, T alterna o slideshow'
              }
              className={`flex items-center justify-center gap-2 ${presentationMode ? 'px-4 py-2.5' : 'w-10 h-10'} bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white transition-all hover:scale-105`}
            >
              {presentationMode ? (
                <>
                  <Minimize2 className="w-5 h-5" aria-hidden />
                  <span className="text-sm font-medium">Sair</span>
                </>
              ) : (
                <Monitor className="w-5 h-5" aria-hidden />
              )}
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              title={isDark ? 'Modo Claro' : 'Modo Escuro'}
              className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white transition-all hover:scale-105"
            >
              {isDark ? <Sun className="w-5 h-5" aria-hidden /> : <Moon className="w-5 h-5" aria-hidden />}
            </button>

            {!presentationMode && (
              <>
                {extraActions}

                <button
                  type="button"
                  onClick={onExport}
                  disabled={exporting || ticketsCount === 0}
                  aria-label="Exportar relatório para Excel"
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl text-white font-medium transition-all disabled:opacity-50 hover:scale-105"
                >
                  <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} aria-hidden />
                  {exporting ? 'Exportando...' : 'Excel'}
                </button>

                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={refreshing}
                  aria-label="Atualizar dados"
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all disabled:opacity-50 hover:scale-105"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
                  {refreshing ? 'Atualizando...' : 'Atualizar'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
