import type { Lead } from '../types/lead';

/**
 * Reparte el precio final acordado, sin recargos automáticos ni cobros.
 *
 * Pesos enteros, no centavos: MoneyInput solo acepta dígitos (descarta
 * cualquier `.` o `,` al escribir), así que un monto con decimales (ej.
 * 2498.5 al repartir $4.997 entre 2 cuotas) se desformateaba mal al
 * mostrarse — "2498.5" perdía el punto y se leía como "24985" → "$24.985"
 * en vez de "$2.499" (bug reportado 20-oct-2026). Se reparte en enteros
 * desde el origen; la última cuota absorbe el resto del redondeo.
 */
export function calcularPlanCuotas(precio: number, cantidad: number): number[] {
  if (!Number.isFinite(precio) || precio <= 0) return [];
  const n = Number.isFinite(cantidad) ? Math.max(1, Math.min(4, Math.trunc(cantidad))) : 1;
  const total = Math.round(precio);
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? total - base * (n - 1) : base));
}

/** No altera importes de cuotas confirmadas ni el primer cobro registrado. */
export function patchPlanCuotas(lead: Lead, precio: number, cantidad: number): Partial<Lead> {
  const montos = calcularPlanCuotas(precio, cantidad);
  if (!montos.length) throw new Error('Pon un precio pactado mayor que cero.');
  const existentes = [
    { monto: lead.pago2Monto, pagado: lead.pago2Pagado },
    { monto: lead.pago3Monto, pagado: lead.pago3Pagado },
    { monto: lead.pago4Monto, pagado: lead.pago4Pagado },
  ];
  existentes.forEach((cuota, i) => {
    if (cuota.pagado && cuota.monto !== montos[i + 1]) {
      throw new Error('Hay cuotas pagadas. Ajusta solo las pendientes para conservar los cobros confirmados.');
    }
  });
  const patch: Record<string, number | boolean | null> = { pago1Monto: montos[0] };
  for (let n = 2; n <= 4; n++) {
    patch[`pago${n}Monto`] = montos[n - 1] ?? null;
    if (montos[n - 1] === undefined) {
      patch[`pago${n}Fecha`] = null;
      patch[`pago${n}Pagado`] = false;
    }
  }
  return patch as Partial<Lead>;
}
