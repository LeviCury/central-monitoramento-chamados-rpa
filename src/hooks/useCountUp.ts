/**
 * Tween de número via `requestAnimationFrame`, com easing
 * `easeOutExpo` e respeito a `prefers-reduced-motion` (snap direto
 * ao valor final). Sem dependências externas.
 *
 * Retorna o valor atual, formatado por `formatter` (default: arredonda
 * para inteiro). Recomeça quando `target` muda.
 */
import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export interface UseCountUpOptions {
  /** Tempo total da animação em ms. Default: 900 */
  durationMs?: number;
  /** Valor inicial (apenas no primeiro mount). Default: 0 */
  from?: number;
  /** Função de formatação. Default: arredonda inteiro com pt-BR */
  formatter?: (value: number) => string;
  /** Decimais a preservar no valor numérico. Default: 0 */
  decimals?: number;
}

const easeOutExpo = (t: number): number =>
  t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

const defaultFormatter = (decimals: number) => (value: number) => {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export function useCountUp(
  target: number,
  options: UseCountUpOptions = {}
): { value: number; formatted: string } {
  const {
    durationMs = 900,
    from = 0,
    decimals = 0,
    formatter = defaultFormatter(decimals),
  } = options;

  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState<number>(reduced ? target : from);
  const startValueRef = useRef<number>(reduced ? target : from);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof requestAnimationFrame !== 'function') {
      setValue(target);
      return;
    }

    if (reduced || !Number.isFinite(target)) {
      setValue(target);
      startValueRef.current = target;
      return;
    }

    const start = startValueRef.current;
    if (start === target) {
      setValue(target);
      return;
    }

    startTimeRef.current = null;

    const tick = (ts: number) => {
      if (startTimeRef.current === null) startTimeRef.current = ts;
      const elapsed = ts - startTimeRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = easeOutExpo(progress);
      const current = start + (target - start) * eased;
      setValue(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        startValueRef.current = target;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Se a próxima execução começar antes da animação terminar,
      // o valor "atual" vira o ponto de partida — animação contínua.
      startValueRef.current = value;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs, reduced]);

  const rounded = decimals > 0
    ? Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
    : Math.round(value);

  return {
    value: rounded,
    formatted: formatter(rounded),
  };
}
