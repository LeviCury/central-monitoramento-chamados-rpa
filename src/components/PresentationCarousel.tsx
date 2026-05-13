import { ReactNode, useEffect, useState } from 'react';
import { config } from '../config';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

interface PresentationCarouselProps {
  slides: { id: string; label: string; content: ReactNode }[];
  active: boolean;
}

/**
 * Slideshow do modo TV — transições cinematográficas:
 *  - Cross-fade com scale 0.985 → 1
 *  - Blur sutil de saída (3px → 0)
 *  - Indicadores de slide com dot ativo *contendo* uma barra de
 *    progresso linear sincronizada com `presentationCarouselMs`.
 */
export function PresentationCarousel({ slides, active }: PresentationCarouselProps) {
  const [index, setIndex] = useState(0);
  const reduced = usePrefersReducedMotion();
  const intervalMs = config.ui.presentationCarouselMs;

  useEffect(() => {
    if (!active || slides.length <= 1) return;
    const id = setInterval(() => {
      setIndex(prev => (prev + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, slides.length, intervalMs]);

  if (!active || slides.length === 0) return null;

  const current = slides[index];

  return (
    <section
      className="space-y-5"
      role="region"
      aria-label={`Slideshow modo TV — ${current.label}`}
    >
      {/* Header com nome + indicadores */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-white/80">
          <span className="text-[11px] uppercase tracking-[0.32em] text-white/45 font-semibold">
            Modo TV
          </span>
          <span className="h-4 w-px bg-white/15" aria-hidden />
          <span className="text-base font-semibold tracking-tight">{current.label}</span>
        </div>

        {/* Indicadores: dot ativo "engole" uma progress bar linear */}
        <div
          className="flex items-center gap-2"
          role="tablist"
          aria-label="Slides"
        >
          {slides.map((s, i) => {
            const isActive = i === index;
            return (
              <span
                key={s.id}
                role="tab"
                aria-selected={isActive}
                aria-label={s.label}
                className={`relative block h-1.5 rounded-full overflow-hidden transition-[width,background-color] duration-300 ease-out ${
                  isActive
                    ? 'w-12 bg-white/15'
                    : 'w-1.5 bg-white/25 hover:bg-white/40'
                }`}
              >
                {isActive && (
                  <span
                    key={`progress-${index}`}
                    className="absolute inset-0 origin-left bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                    style={{
                      animation: reduced
                        ? undefined
                        : `progress-linear ${intervalMs}ms linear forwards`,
                      transform: reduced ? 'scaleX(1)' : undefined,
                    }}
                    aria-hidden
                  />
                )}
              </span>
            );
          })}
        </div>
      </div>

      {/* Slide content — wrapper anima cross-fade + scale + blur */}
      <div className="relative">
        <div
          key={current.id}
          className="presentation-slide animate-presentation-in"
        >
          {current.content}
        </div>
      </div>

      <style>{`
        @keyframes presentation-in {
          from {
            opacity: 0;
            transform: scale(0.985);
            filter: blur(3px);
          }
          to {
            opacity: 1;
            transform: scale(1);
            filter: blur(0);
          }
        }
        .animate-presentation-in {
          animation: presentation-in 380ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-presentation-in {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
