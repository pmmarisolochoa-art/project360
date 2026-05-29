import { format, formatDistanceToNow, isToday, isTomorrow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatDate(iso: string, pattern = "d 'de' MMM"): string {
  return format(parseISO(iso), pattern, { locale: es });
}

export function formatRelative(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return `Hoy, ${format(d, 'HH:mm')}`;
  if (isTomorrow(d)) return `Mañana, ${format(d, 'HH:mm')}`;
  return formatDistanceToNow(d, { addSuffix: true, locale: es });
}

export function formatTime(iso: string): string {
  return format(parseISO(iso), 'HH:mm');
}

export function isoFromNow(days: number, hours = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}
