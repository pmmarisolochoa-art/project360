import type { Task } from '@/types/task';

export interface Pendientes {
  /** Vencidas, de la más atrasada a la más reciente. */
  vencidas: Array<{ task: Task; dias: number }>;
  /** Vencen HOY. */
  hoy: Task[];
}

/**
 * Reparte tareas en "retrasadas" y "de hoy".
 *
 * Vive aparte del hook y sin dependencias a propósito: así se puede probar de
 * verdad. Metida dentro del hook haría falta React para ejecutarla, y la prueba
 * acabaría siendo una COPIA de la regla — que es exactamente lo que no debe
 * pasar: un `<=` cambiado por un `<` en una de las dos copias hace que una
 * entrega desaparezca sin que nada falle.
 *
 * El corte de "hoy" va por FECHA y no por horas: una tarea que vence hoy a las
 * 23:00 tiene que salir desde la mañana, no a última hora. Y una de hoy a las
 * 00:30 es de HOY, no un retraso.
 */
export function repartirPendientes(tareas: Task[], ahora: Date): Pendientes {
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const finHoy = new Date(inicioHoy.getTime() + 86400000);

  const vencidas: Array<{ task: Task; dias: number }> = [];
  const hoy: Task[] = [];

  for (const t of tareas) {
    if (t.status === 'completed') continue;
    const due = new Date(t.dueDate);
    // Una fecha ilegible se ignora en vez de romper la lista entera.
    if (Number.isNaN(due.getTime())) continue;

    if (due < inicioHoy) {
      // Los días se cuentan entre DÍAS, no entre instantes. Restando marcas de
      // tiempo, una tarea vencida ayer a las 10:00 daba 14 horas → "0 días",
      // que se lee como "vence hoy" justo cuando ya se pasó. Lo encontró la
      // prueba, no la lectura del código.
      //
      // Y se redondea en vez de truncar por los cambios de hora: un día con 23
      // o 25 horas truncaría a uno menos.
      const inicioDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      const dias = Math.round((inicioHoy.getTime() - inicioDue.getTime()) / 86400000);
      vencidas.push({ task: t, dias });
    } else if (due < finHoy) {
      hoy.push(t);
    }
  }

  vencidas.sort((a, b) => b.dias - a.dias);
  hoy.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  return { vencidas, hoy };
}
