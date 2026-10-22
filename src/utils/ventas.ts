import type { Lead } from '@/types/lead';

/**
 * "YYYY-MM-DD" (o un ISO completo — los campos de fecha del lead se guardan
 * así; el `<input type="date">` solo recorta a los primeros 10 caracteres
 * para mostrarlos, ver `dateInputValue` en VentasModule.tsx) → medianoche
 * LOCAL. `new Date('2026-10-10')` a secas la interpreta en UTC, y en un huso
 * detrás de UTC (Colombia, Miami) eso corre la fecha un día atrás al
 * formatear en local — mismo bug que ya resolvió `fechaLocal()` en
 * VentasModule.tsx para el filtro de rango de fechas.
 */
export function parseFechaLocal(fecha: string): Date {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** El primer cobro registrado más las cuotas confirmadas; las fechas no prueban un pago. */
export function totalCobradoLead(lead: Lead): number {
  return (lead.cashCollected ?? 0)
    + (lead.pago2Pagado ? (lead.pago2Monto ?? 0) : 0)
    + (lead.pago3Pagado ? (lead.pago3Monto ?? 0) : 0)
    + (lead.pago4Pagado ? (lead.pago4Monto ?? 0) : 0);
}

export function saldoPendienteLead(lead: Lead): number {
  return Math.max(0, (lead.programValue ?? 0) - totalCobradoLead(lead));
}

export function comisionLead(lead: Lead, rol: 'setter' | 'closer'): number {
  if (lead.etapa !== 'ganado') return 0;
  const porcentaje = rol === 'setter' ? (lead.setterComisionPct ?? 5) : (lead.closerComisionPct ?? 10);
  return Math.round(totalCobradoLead(lead) * porcentaje) / 100;
}

/** Resumen de una selección de leads: el periodo y el cliente los decide quien consulta. */
export function resumenVentas(leads: Lead[]) {
  const ganados = leads.filter((lead) => lead.etapa === 'ganado');
  return {
    salesCount: ganados.length,
    revenueAccumulated: ganados.reduce((sum, lead) => sum + (lead.programValue ?? 0), 0),
    cashCollected: ganados.reduce((sum, lead) => sum + totalCobradoLead(lead), 0),
    // Un sobrepago de una venta no cancela la deuda de otra.
    pendingCollection: ganados.reduce((sum, lead) => sum + saldoPendienteLead(lead), 0),
  };
}

export type CuotaEstado = 'pagada' | 'vencida' | 'pendiente';

export interface CuotaResumen {
  numero: number;
  total: number;
  monto: number;
  fecha?: string;
  estado: CuotaEstado;
  /** Solo si `estado === 'vencida'` — días desde que venció, para mostrar "Nd tarde". */
  diasTarde?: number;
}

/**
 * Una fila por cuota con su estado (pagada/vencida/pendiente) — resumen
 * visual para dar seguimiento rápido sin leer monto+fecha+casilla por
 * separado en cada cuota (founder, 20-oct-2026).
 *
 * La Cuota 1 no tiene casilla "pagada" propia (ver `totalCobradoLead`): se
 * considera cobrada si `cashCollected` tiene algo — ese campo es manual
 * a propósito y no se deriva de este resumen.
 */
export function cuotasConEstado(lead: Lead): CuotaResumen[] {
  // La Cuota 1 SIEMPRE se muestra si hay algo que seguir (ver más abajo) —
  // nunca hay que esperar a que alguien reparta cuotas para que cuente.
  // Total = 1 (cuota 1) + las que sí traen monto propio (bug 20-oct-2026:
  // antes "total" solo contaba montos definidos, y si pago1Monto no estaba
  // definido pero pago2Monto sí, salía "Cuota 2 de 1" — la fila 1 se mostraba
  // igual pero no se contaba).
  const extra = [lead.pago2Monto, lead.pago3Monto, lead.pago4Monto]
    .filter((m) => m !== undefined && m !== null).length;
  const hayPago1 = lead.pago1Monto !== undefined && lead.pago1Monto !== null;
  if (!hayPago1 && extra === 0) return [];
  const total = 1 + extra;

  const hoy = new Date();
  const filas: CuotaResumen[] = [{
    numero: 1,
    total,
    monto: lead.pago1Monto ?? 0,
    fecha: lead.pago1Fecha,
    estado: (lead.cashCollected ?? 0) > 0 ? 'pagada' : 'pendiente',
  }];

  ([
    { monto: lead.pago2Monto, fecha: lead.pago2Fecha, pagado: lead.pago2Pagado },
    { monto: lead.pago3Monto, fecha: lead.pago3Fecha, pagado: lead.pago3Pagado },
    { monto: lead.pago4Monto, fecha: lead.pago4Fecha, pagado: lead.pago4Pagado },
  ] as const).forEach((c, i) => {
    if (c.monto === undefined || c.monto === null) return;
    let estado: CuotaEstado = 'pendiente';
    let diasTarde: number | undefined;
    if (c.pagado) {
      estado = 'pagada';
    } else if (c.fecha && parseFechaLocal(c.fecha) < hoy) {
      estado = 'vencida';
      diasTarde = Math.max(1, Math.floor((hoy.getTime() - parseFechaLocal(c.fecha).getTime()) / 86400000));
    }
    filas.push({ numero: i + 2, total, monto: c.monto, fecha: c.fecha, estado, diasTarde });
  });

  return filas;
}

/**
 * Ventas del cliente = leads en etapa 'ganado'. Dos cifras, no una:
 * `revenueAccumulated` (programValue, el precio PACTADO) vs `cashCollected`
 * (lo YA cobrado) — un cliente pagando en cuotas cierra el valor completo
 * pero cobra de a poco, y son preguntas distintas ("¿cuánto vendí?" vs
 * "¿cuánto tengo en caja?").
 *
 * Igual que `avanceForClient`: se deriva EN VIVO de los leads reales, no de
 * `client.metrics.salesCount/revenueAccumulated` (un valor guardado que nunca
 * se recalculaba y se quedaba en 0 aunque hubiera ventas reales).
 */
export function ventasForClient(allLeads: Lead[], clientId: string): {
  salesCount: number;
  revenueAccumulated: number;
  cashCollected: number;
} {
  return resumenVentas(allLeads.filter((lead) => lead.clientId === clientId));
}
