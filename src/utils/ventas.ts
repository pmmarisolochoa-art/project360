import type { Lead } from '@/types/lead';

/**
 * Ventas del cliente = leads en etapa 'ganado'. `revenueAccumulated` usa
 * `programValue` (el precio pactado), no `cashCollected` (lo YA cobrado) —
 * para que "facturación" cuente el cierre, no el recaudo parcial.
 *
 * Igual que `avanceForClient`: se deriva EN VIVO de los leads reales, no de
 * `client.metrics.salesCount/revenueAccumulated` (un valor guardado que nunca
 * se recalculaba y se quedaba en 0 aunque hubiera ventas reales).
 */
export function ventasForClient(allLeads: Lead[], clientId: string): { salesCount: number; revenueAccumulated: number } {
  const ganados = allLeads.filter((l) => l.clientId === clientId && l.etapa === 'ganado');
  return {
    salesCount: ganados.length,
    revenueAccumulated: ganados.reduce((sum, l) => sum + (l.programValue ?? 0), 0),
  };
}
