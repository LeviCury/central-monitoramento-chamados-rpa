import { ReactNode, useEffect, useState } from 'react';
import { config } from '../config';

interface PresentationCarouselProps {
  slides: { id: string; label: string; content: ReactNode }[];
  active: boolean;
}

export function PresentationCarousel({ slides, active }: PresentationCarouselProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active || slides.length <= 1) return;
    const id = setInterval(() => {
      setIndex(prev => (prev + 1) % slides.length);
    }, config.ui.presentationCarouselMs);
    return () => clearInterval(id);
  }, [active, slides.length]);

  if (!active) return null;
  if (slides.length === 0) return null;

  const current = slides[index];

  return (
    <section
      className="space-y-4"
      role="region"
      aria-label={`Slideshow modo TV — ${current.label}`}
    >
      <div className="flex items-center justify-between text-white/70 text-sm">
        <span className="uppercase tracking-widest">Modo TV</span>
        <div className="flex items-center gap-1.5">
          {slides.map((s, i) => (
            <span
              key={s.id}
              aria-hidden
              className={`block h-1 rounded-full transition-all ${
                i === index ? 'w-6 bg-emerald-400' : 'w-2 bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>
      <div key={current.id} className="animate-fade-in">
        {current.content}
      </div>
    </section>
  );
}
