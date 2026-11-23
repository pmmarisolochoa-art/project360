import type { Lead } from '@/types/lead';

/** "YYYY-MM" del mes actual, en hora local. */
export function periodoActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Nombre legible del período, ej. "octubre 2026". */
export function periodoLabel(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' });
}

/** Los últimos `n` períodos hasta el actual, más reciente primero. */
export function ultimosPeriodos(n: number, hasta = periodoActual()): string[] {
  const [y, m] = hasta.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - 1 - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

function rangoDePeriodo(periodo: string): { start: Date; end: Date } {
  const [y, m] = periodo.split('-').map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59, 999) };
}

/**
 * Ingresos del mes = pagos CONFIRMADOS de leads ganados de este cliente
 * cuya fecha cae en el período. Mismo criterio que Ventas usa para "Cash
 * collected" (VentasModule.tsx, founder 21/22-oct-2026): si falta la fecha
 * propia del pago se usa `updatedAt` del lead como respaldo, porque exigir
 * la fecha hacía desaparecer pagos cobrados el mismo día. Si esa regla
 * cambia en Ventas, cambia aquí también — es la misma cifra de negocio.
 */
export function ingresosDelMes(leads: Lead[], clientId: string, periodo: string): number {
  const { start, end } = rangoDePeriodo(periodo);
  const enRango = (fecha?: string) => {
    if (!fecha) return false;
    const t = new Date(fecha);
    return t >= start && t <= end;
  };
  return leads
    .filter((l) => l.clientId === clientId && l.etapa === 'ganado')
    .reduce((sum, l) => {
      let total = 0;
      if ((l.cashCollected ?? 0) > 0 && enRango(l.pago1Fecha ?? l.updatedAt)) total += l.cashCollected ?? 0;
      if (l.pago2Pagado && enRango(l.pago2Fecha ?? l.updatedAt)) total += l.pago2Monto ?? 0;
      if (l.pago3Pagado && enRango(l.pago3Fecha ?? l.updatedAt)) total += l.pago3Monto ?? 0;
      if (l.pago4Pagado && enRango(l.pago4Fecha ?? l.updatedAt)) total += l.pago4Monto ?? 0;
      return sum + total;
    }, 0);
}

/** Ventas cerradas en el mes (valor contratado cuyo `closedAt` cae en el período). */
export function ventasCerradasDelMes(leads: Lead[], clientId: string, periodo: string): number {
  const { start, end } = rangoDePeriodo(periodo);
  return leads
    .filter((l) => l.clientId === clientId && l.etapa === 'ganado' && l.closedAt)
    .filter((l) => { const t = new Date(l.closedAt as string); return t >= start && t <= end; })
    .reduce((sum, l) => sum + (l.programValue ?? 0), 0);
}
