import type { Task } from '@/types/task';

/**
 * Avance del proyecto = % de tareas completadas del cliente.
 *
 * Antes `progressPercent` era un valor fijo puesto al crear el cliente (5%) que
 * nunca se recalculaba. Ahora se deriva en vivo de las tareas reales.
 */
export function avanceFromTasks(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === 'completed').length;
  return Math.round((done / tasks.length) * 100);
}

/** Avance de un cliente concreto a partir de una lista de tareas de varios clientes. */
export function avanceForClient(allTasks: Task[], clientId: string): number {
  return avanceFromTasks(allTasks.filter((t) => t.clientId === clientId));
}
