export function formatHoursMinutes(value: number | null | undefined): string {
  const safeValue = Number.isFinite(value ?? 0) ? value ?? 0 : 0;
  const totalMinutes = Math.round(safeValue * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0 && minutes === 0) return '0h';
  if (minutes === 0) return `${hours}h`;
  if (hours === 0) return `${minutes}m`;

  return `${hours}h ${minutes}m`;
}
