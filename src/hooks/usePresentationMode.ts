/**
 * Modo apresentação (fullscreen) + atalhos de teclado.
 * - Ctrl+P: alterna apresentação
 * - Esc: sai
 * - F: alterna apenas fullscreen
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface PresentationOptions {
  /** Se verdadeiro, ativa modo TV (slideshow). */
  carouselDefault?: boolean;
}

export function usePresentationMode(options: PresentationOptions = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const [tvMode, setTvMode] = useState(Boolean(options.carouselDefault));

  const enterPresentation = useCallback(async () => {
    try {
      if (ref.current?.requestFullscreen) {
        await ref.current.requestFullscreen();
      }
    } catch {
      /* fullscreen não suportado, segue em modo simulado */
    }
    setPresentationMode(true);
  }, []);

  const exitPresentation = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ignore */
    }
    setPresentationMode(false);
    setTvMode(false);
  }, []);

  const toggle = useCallback(async () => {
    if (!presentationMode) {
      await enterPresentation();
    } else {
      await exitPresentation();
    }
  }, [presentationMode, enterPresentation, exitPresentation]);

  /**
   * Entra direto em apresentação + TV mode (slideshow), em uma única ação.
   * Usado pelo botão "Modo TV" do header.
   */
  const enterTv = useCallback(async () => {
    if (!presentationMode) {
      await enterPresentation();
    }
    setTvMode(true);
  }, [presentationMode, enterPresentation]);

  /**
   * Botão "Modo TV" inteligente:
   * - fora da apresentação: entra em apresentação + liga TV
   * - em apresentação sem TV: liga TV
   * - em apresentação com TV: desliga TV (mantém apresentação)
   */
  const toggleTv = useCallback(async () => {
    if (!presentationMode) {
      await enterTv();
      return;
    }
    setTvMode(prev => !prev);
  }, [presentationMode, enterTv]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && presentationMode) {
        setPresentationMode(false);
        setTvMode(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [presentationMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'p' && e.ctrlKey) {
        e.preventDefault();
        toggle();
      } else if (e.key === 'Escape' && presentationMode) {
        setPresentationMode(false);
        setTvMode(false);
      } else if (e.key.toLowerCase() === 't' && presentationMode) {
        setTvMode(prev => !prev);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggle, presentationMode]);

  return {
    presentationMode,
    tvMode,
    setTvMode,
    toggle,
    enterTv,
    toggleTv,
    ref,
  };
}
