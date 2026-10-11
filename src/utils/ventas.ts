import type { Lead } from '@/types/lead';

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
