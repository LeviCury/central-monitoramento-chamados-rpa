import {
  Download,
  Layers,
  Minimize2,
  Monitor,
  Moon,
  RefreshCw,
  RotateCcw,
  Sun,
} from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
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
  extraActions?: ReactNode;
}

/**
 * Header Apple/Linear-style:
 *  - Tipografia grande do título, metadata em UMA linha leve abaixo.
 *  - Sticky com glass sutil; eleva sutilmente ao rolar.
 *  - Em modo apresentação: fundo near-black, tipografia ainda maior.
 */
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

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (presentationMode) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [presentationMode]);

  const useSegmented = groups.length > 1 && groups.length <= 3;
  const useDropdown = groups.length > 3;

  // Paleta condicional: presentation = dark; normal = transluscent neutro
  if (presentationMode) {
    return (
      <header className="relative z-40 bg-[#09090b] border-b border-white/8">
        <div className="px-10 py-6">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <img
                src={MINERVA_LOGO_LIGHT}
                alt="Minerva Foods"
                className="h-12 object-contain"
              />
              <div className="h-10 w-px bg-white/10" aria-hidden />
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-semibold mb-1">
                  Minerva Foods · RPA
                </p>
                <h1 className="text-3xl font-semibold text-white tracking-[-0.02em] leading-tight">
                  Central de Monitoramento
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/8 border border-white/10 text-white/85 text-xs">
                <span className="live-dot" aria-hidden />
                Ao vivo · {timeAgo}
              </span>
              <button
                type="button"
                onClick={onTogglePresentation}
                aria-label="Sair do modo apresentação (Esc)"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-medium transition-colors"
              >
                <Minimize2 className="w-4 h-4" aria-hidden />
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header
      className={[
        'sticky top-0 z-40 transition-all duration-200',
        scrolled
          ? 'glass-strong shadow-subtle'
          : 'glass border-transparent',
      ].join(' ')}
    >
      <div className="max-w-[1400px] mx-auto px-8 py-5">
        <div className="flex items-center justify-between gap-6">
          {/* LEFT: brand + título + metadata */}
          <div className="flex items-center gap-4 min-w-0">
            <img
              src={MINERVA_LOGO_LIGHT}
              alt="Minerva Foods"
              className={`h-9 object-contain transition-opacity ${isDark ? 'opacity-90' : 'opacity-100'}`}
              style={{ filter: isDark ? 'none' : 'brightness(0.85) contrast(1.1)' }}
            />
            <div className="h-7 w-px bg-[var(--border-default)]" aria-hidden />
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold text-[var(--text-primary)] tracking-[-0.02em] leading-tight truncate">
                Central de Monitoramento
              </h1>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="live-dot" aria-hidden />
                  <span>Ao vivo · {timeAgo}</span>
                </span>
                <span className="text-[var(--text-tertiary)]">·</span>
                <span>{periodLabel}</span>
                <span className="text-[var(--text-tertiary)]">·</span>
                <span className="tnum">
                  <span className="font-semibold text-[var(--text-primary)]">
                    {ticketsCount.toLocaleString('pt-BR')}
                  </span>{' '}
                  chamados
                </span>
                {!isDefaultGroup && (
                  <>
                    <span className="text-[var(--text-tertiary)]">·</span>
                    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                      Fila {activeGroup.name}
                      <button
                        type="button"
                        onClick={() => onGroupChange(config.glpi.defaultGroupId)}
                        className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-amber-500/20"
                        aria-label="Voltar para a fila padrão"
                        title="Voltar para a fila padrão"
                      >
                        <RotateCcw className="w-3 h-3" aria-hidden />
                      </button>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: ações */}
          <div className="flex items-center gap-2">
            {useSegmented && (
              <div
                role="radiogroup"
                aria-label="Grupo técnico"
                className="inline-flex items-center p-0.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
              >
                {groups.map(g => {
                  const active = g.id === groupId;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => onGroupChange(g.id)}
                      className={[
                        'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                        active
                          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-subtle'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                      ].join(' ')}
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            )}

            {useDropdown && (
              <label className="relative inline-flex items-center">
                <span className="sr-only">Selecionar grupo técnico</span>
                <Layers
                  className="absolute left-3 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none"
                  aria-hidden
                />
                <select
                  value={groupId}
                  onChange={e => onGroupChange(e.target.value)}
                  aria-label="Grupo técnico"
                  className="pl-9 pr-8 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ring-color)] transition-all appearance-none"
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <IconBtn onClick={onTogglePresentation} ariaLabel="Modo apresentação (Ctrl+P)">
              <Monitor className="w-4 h-4" aria-hidden />
            </IconBtn>

            <IconBtn
              onClick={toggleTheme}
              ariaLabel={isDark ? 'Tema claro' : 'Tema escuro'}
            >
              {isDark ? <Sun className="w-4 h-4" aria-hidden /> : <Moon className="w-4 h-4" aria-hidden />}
            </IconBtn>

            {extraActions}

            <button
              type="button"
              onClick={onExport}
              disabled={exporting || ticketsCount === 0}
              aria-label="Exportar para Excel"
              className="ghost-btn"
            >
              <Download
                className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`}
                aria-hidden
              />
              {exporting ? 'Exportando…' : 'Excel'}
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Atualizar dados"
              className="primary-btn"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden
              />
              {refreshing ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

interface IconBtnProps {
  onClick: () => void;
  ariaLabel: string;
  children: ReactNode;
}

function IconBtn({ onClick, ariaLabel, children }: IconBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] border border-transparent hover:border-[var(--border-subtle)] transition-colors"
    >
      {children}
    </button>
  );
}
