/**
 * Boolean reativo que reflete `prefers-reduced-motion: reduce`.
 * Usado para gatilhar "snap" em animações pesadas (count-up, drawer
 * transitions, slideshow, etc.) e respeitar preferência do usuário.
 */
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function getInitial(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(QUERY).matches;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(getInitial);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(QUERY);
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    mql.addEventListener?.('change', handler);
    return () => {
      mql.removeEventListener?.('change', handler);
    };
  }, []);

  return reduced;
}
