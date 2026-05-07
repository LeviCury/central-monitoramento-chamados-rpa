import { Bookmark, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
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

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name);
    setName('');
    setOpen(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-minerva p-4 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-minerva-navy dark:text-white">
        <Bookmark className="w-4 h-4" aria-hidden />
        <span className="font-medium text-sm">Presets</span>
      </div>

      {presets.length === 0 && (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Salve combinações de filtros para reaproveitar.
        </span>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {presets.map(preset => (
          <span
            key={preset.id}
            className="inline-flex items-center gap-1 bg-minerva-navy/5 dark:bg-white/10 rounded-full pl-3 pr-1 py-1 text-sm text-minerva-navy dark:text-white"
          >
            <button
              type="button"
              onClick={() => onApply(preset)}
              className="hover:underline"
            >
              {preset.name}
            </button>
            <button
              type="button"
              onClick={() => onRemove(preset.id)}
              aria-label={`Remover preset ${preset.name}`}
              className="w-6 h-6 inline-flex items-center justify-center rounded-full hover:bg-minerva-red/20 text-minerva-red"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden />
            </button>
          </span>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {open ? (
          <>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome do preset"
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-minerva-navy/20"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 bg-minerva-navy text-white rounded-lg text-sm font-medium hover:bg-minerva-navy-light"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-minerva-navy dark:hover:text-white"
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-minerva-navy/5 dark:bg-white/10 hover:bg-minerva-navy/10 dark:hover:bg-white/20 rounded-lg text-sm font-medium text-minerva-navy dark:text-white"
          >
            <Plus className="w-4 h-4" aria-hidden />
            Salvar atual
          </button>
        )}
      </div>
    </div>
  );
}
