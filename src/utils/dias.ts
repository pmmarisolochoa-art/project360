/**
 * Días completos entre dos fechas, contando DÍAS y no instantes.
 *
 * Existe porque la misma cuenta ya se escribió mal dos veces:
 *   · en las notificaciones, una tarea vencida ayer a las 10:00 daba 14 horas
 *     → "0 días", que se lee como "vence hoy" justo cuando ya se pasó;
 *   · en el informe ROPRE, un entregable vencido hace 3 días a las 23:00 daba
 *     58 horas → "2 días".
 *
 * Los dos son el mismo error: restar marcas de tiempo cuando lo que se quiere
 * contar son días de calendario. A la tercera copia tocaba sacarlo aquí.
 *
 * Se redondea en vez de truncar por los cambios de hora: un día de 23 o 25
 * horas truncaría a uno menos.
 */
export function diasEntre(desde: Date, hasta: Date): number {
  const a = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const b = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
