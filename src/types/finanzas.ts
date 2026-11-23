/**
 * Cajón Finanzas — gastos y meta de ingresos por cliente y mes.
 * Los ingresos NO viven aquí: se derivan en vivo de `leads` ganados
 * (ver `utils/finanzas.ts`), igual que Ventas deriva sus propias cifras.
 */
export interface FinanzasMensual {
  id: string;
  clientId: string;
  /** "YYYY-MM" */
  periodo: string;
  gastosAds: number;
  gastosOtros: number;
  metaIngresos?: number | null;
  notas?: string;
  createdAt: string;
  updatedAt: string;
}
