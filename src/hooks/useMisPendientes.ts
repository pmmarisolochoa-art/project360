import { useMemo } from 'react';
import { useClientStore } from '@/store/useClientStore';
import { useIdentidadTareas } from '@/hooks/useTareasPropias';
import type { Task } from '@/types/task';
import { repartirPendientes } from '@/utils/repartirPendientes';

export interface MisPendientes {
  /** Vencidas, de la más atrasada a la más reciente. */
  vencidas: Array<{ task: Task; dias: number }>;
  /** Vencen HOY (por fecha, no por horas). */
  hoy: Task[];
  total: number;
}

/**
 * Lo que ME falta AHORA: mis tareas retrasadas y las que vencen hoy.
 *
 * SE CALCULA, NO SE GUARDA. Antes esto vivía en un store en memoria que se
 * rellenaba al arrancar y tenía marca de "leído": el número era el mismo para
 * todo el mundo y el "leído" no sobrevivía a una recarga, así que prometía algo
 * que no cumplía. Una tarea sale de aquí cuando se completa o se le cambia la
 * fecha — que es lo único que de verdad la quita de tu día.
 *
 * El corte de "hoy" es por FECHA y no por horas: una tarea que vence hoy a las
 * 23:00 tiene que aparecer desde la mañana, no a última hora.
 */
export function useMisPendientes(): MisPendientes {
  const tasks = useClientStore((s) => s.tasks);
  const { esMia } = useIdentidadTareas();

  return useMemo(() => {
    // El filtro de "mía" y el reparto por fechas están separados a propósito:
    // el primero necesita los stores, el segundo es puro y por eso se puede
    // probar de verdad (pruebas/mis-pendientes.mjs).
    const mias = tasks.filter(esMia);
    const { vencidas, hoy } = repartirPendientes(mias, new Date());
    return { vencidas, hoy, total: vencidas.length + hoy.length };
  }, [tasks, esMia]);
}
