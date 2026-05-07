/**
 * "Atualizado há X minutos" — recalcula a cada 30 segundos.
 */
import { useEffect, useState } from 'react';

function format(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'agora';
  if (mins === 1) return 'há 1 minuto';
  if (mins < 60) return `há ${mins} minutos`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return 'há 1 hora';
  return `há ${hours} horas`;
}

export function useTimeAgo(date: Date): string {
  const [label, setLabel] = useState(() => format(date));

  useEffect(() => {
    setLabel(format(date));
    const interval = setInterval(() => setLabel(format(date)), 30_000);
    return () => clearInterval(interval);
  }, [date]);

  return label;
}
