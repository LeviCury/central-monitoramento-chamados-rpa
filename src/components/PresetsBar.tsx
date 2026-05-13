import { Bookmark, Check, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FilterPreset } from '../hooks/useDashboardFilters';

interface PresetsBarProps {
  presets: FilterPreset[];
  onApply: (preset: FilterPreset) => void;
  onSave: (name: string) => void;
  onRemove: (id: string) => void;
}

export function PresetsBar({ presets, onApply, onSave, onRemove }: PresetsBarProps) {
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName('');
    setOpen(false);
    setSavedId(`saved-${Date.now()}`);
  };

  useEffect(() => {
    if (!savedId) return;
    const t = setTimeout(() => setSavedId(null), 1500);
    return () => clearTimeout(t);
  }, [savedId]);

  return (
    <div className="surface-elevated rounded-2xl px-5 py-3.5 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2.5 text-[var(--text-primary)]">
        <Bookmark className="w-3.5 h-3.5 text-[var(--text-tertiary)]" aria-hidden />
        <span className="font-semibold text-sm tracking-[-0.01em]">Presets</span>
      </div>

      {presets.length === 0 && !open && (
        <span className="text-xs text-[var(--text-tertiary)]">
          Salve combinações de filtros para reaproveitar.
        </span>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {presets.map(preset => (
          <span
            key={preset.id}
            className="group inline-flex items-center bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-full pl-3 pr-1 py-1 text-xs text-[var(--text-primary)] transition-all"
          >
            <button
              type="button"
              onClick={() => onApply(preset)}
              className="font-medium pr-1.5"
              title={`Aplicar preset ${preset.name}`}
            >
              {preset.name}
            </button>
            <button
              type="button"
              onClick={() => onRemove(preset.id)}
              aria-label={`Remover preset ${preset.name}`}
              className="opacity-0 group-hover:opacity-100 inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-rose-500/15 text-[var(--text-tertiary)] hover:text-rose-600 transition-all"
            >
              <X className="w-3 h-3" aria-hidden />
            </button>
          </span>
        ))}

        {savedId && (
          <span
            key={savedId}
            className="inline-flex items-center gap-1 pl-2.5 pr-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold animate-fade-in-up"
            role="status"
            aria-live="polite"
          >
            <Check className="w-3 h-3" aria-hidden />
            Salvo
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {open ? (
          <>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome do preset"
              className="px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-color)] focus:border-transparent transition-all"
              onKeyDown={e => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') {
                  setOpen(false);
                  setName('');
                }
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim()}
              className="primary-btn"
            >
              <Check className="w-3.5 h-3.5" aria-hidden />
              Salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setName('');
              }}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ghost-btn"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden />
            Salvar atual
          </button>
        )}
      </div>
    </div>
  );
}
