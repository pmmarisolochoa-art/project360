import type { Task } from '@/types/task';

/**
 * Vencimiento y puntualidad de tareas — FUENTE ÚNICA.
 *
 * POR QUÉ EXISTE (24-ago-2026, hallazgo del Glosario de Métricas):
 * "vencida" se leía de `task.isDelayed`, que NO es un cálculo sino una MARCA
 * GUARDADA en la base. Quien la escribe es `useTaskMonitor`, un vigilante que
 * corre en el NAVEGADOR. Consecuencias medidas:
 *
 *   1. Si nadie abre la app, ninguna tarea se marca como vencida. El número se
 *      queda congelado y nadie se entera — el peor fallo posible.
 *   2. El vigilante solo revisa las tareas que esa persona puede ver, así que
 *      QUIÉN ESTÉ CONECTADO cambia qué se marca.
 *   3. `delayDays` solo avanza mientras alguien tiene la app abierta, así que
 *      un "+3d" puede llevar días sin moverse.
 *
 * REGLA: para MOSTRAR y CONTAR se calcula aquí, en vivo, comparando fechas.
 * La marca guardada se conserva, pero solo sirve para no repetir avisos
 * (`useTaskMonitor`). Contar y avisar son cosas distintas.
 */

/** Una tarea está vencida si no está completada y su fecha de entrega ya pasó. */
export function estaVencida(task: Pick<Task, 'status' | 'dueDate'>, now: number = Date.now()): boolean {
  if (task.status === 'completed') return false;
  const due = new Date(task.dueDate).getTime();
  // Una fecha ilegible no se cuenta como vencida: inventaría un problema.
  if (!Number.isFinite(due)) return false;
  return due < now;
}

/** Días de atraso respecto a la fecha pactada. 0 si no está vencida. */
export function diasDeAtraso(task: Pick<Task, 'status' | 'dueDate'>, now: number = Date.now()): number {
  if (!estaVencida(task, now)) return 0;
  const due = new Date(task.dueDate).getTime();
  return Math.max(1, Math.ceil((now - due) / 86_400_000));
}

/**
 * ¿Se entregó dentro del plazo pactado?
 *
 * Se compara `completedAt` contra `dueDate` en vez de mirar `isDelayed`, por lo
 * mismo de arriba: si la app estuvo cerrada mientras la tarea se pasaba de
 * fecha, la marca nunca se puso y una entrega tardía contaría como puntual.
 *
 * `null` = todavía no se entregó, así que no se puede juzgar. No es lo mismo
 * que "no fue puntual", y por eso no devuelve `false`.
 */
export function seEntregoATiempo(task: Pick<Task, 'status' | 'dueDate' | 'completedAt'>): boolean | null {
  if (task.status !== 'completed') return null;
  if (!task.completedAt) return null;
  const done = new Date(task.completedAt).getTime();
  const due = new Date(task.dueDate).getTime();
  if (!Number.isFinite(done) || !Number.isFinite(due)) return null;
  return done <= due;
}

/** Cuántas de estas tareas están vencidas. */
export function contarVencidas(tasks: Array<Pick<Task, 'status' | 'dueDate'>>, now: number = Date.now()): number {
  return tasks.reduce((n, t) => (estaVencida(t, now) ? n + 1 : n), 0);
}
