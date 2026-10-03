import type { Lead } from '@/types/lead';

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
  const ganados = allLeads.filter((l) => l.clientId === clientId && l.etapa === 'ganado');
  return {
    salesCount: ganados.length,
    revenueAccumulated: ganados.reduce((sum, l) => sum + (l.programValue ?? 0), 0),
    cashCollected: ganados.reduce((sum, l) => sum + (l.cashCollected ?? 0), 0),
  };
}
