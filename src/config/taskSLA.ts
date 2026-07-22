/**
 * SLA por tipo de tarea (Bloque B — inteligencia de reuniones).
 *
 * Un "SLA" aquí es el TIEMPO OBJETIVO (en días hábiles-calendario) que debería
 * tardar en entregarse una tarea según su tipo (`tag`). Sirve para dos cosas:
 *   1) Medir cumplimiento: ¿la tarea se entregó dentro de su tiempo objetivo?
 *   2) Detectar atrasos antes de que un compromiso se enfríe.
 *
 * Fuente única: ajusta los días AQUÍ y todo el resto (recap de reuniones, y a
 * futuro Equipo) lo respeta. No requiere migración — es config de código.
 *
 * NOTA para la founder: estos números son un punto de partida sensato. Cámbialos
 * a los tiempos reales que manejas con tus clientes. Si más adelante quieres que
 * cada cliente tenga su propio SLA, se puede mover a la BD (como la meta de KPI).
 */

import type { Task, TaskTag } from '@/types/task';

/** Días objetivo de entrega por tipo de tarea. */
export const TASK_SLA_DAYS: Record<TaskTag, number> = {
  ads: 2,          // montar/ajustar pauta
  content: 2,      // copies, piezas, guiones
  strategy: 3,     // planeación, análisis
  meeting: 1,      // preparar/seguir una reunión
  deliverable: 3,  // entregable formal
  ropre: 5,        // resultado/proyecto (más largo por naturaleza)
  other: 3,        // sin clasificar
};

export type SLAState = 'dentro' | 'fuera' | 'sin-datos';

export interface SLAResult {
  state: SLAState;
  /** Días objetivo para este tipo de tarea. */
  targetDays: number;
  /** Días transcurridos: de creación a entrega (si completada) o a hoy (si abierta). */
  elapsedDays: number;
  /** Días que lleva vencida respecto a su dueDate (0 si no está vencida). */
  overdueDays: number;
}

const DAY = 86_400_000;

const daysBetween = (fromISO: string, toMs: number): number => {
  const from = new Date(fromISO).getTime();
  if (Number.isNaN(from)) return 0;
  return Math.max(0, Math.floor((toMs - from) / DAY));
};

/**
 * Evalúa una tarea contra su SLA.
 * - Completada: dentro/fuera según el tiempo real de entrega (createdAt → completedAt).
 * - Abierta: dentro/fuera según los días que ya lleva viva (createdAt → hoy).
 * `overdueDays` mide el atraso respecto al dueDate pactado (independiente del SLA).
 */
export function evaluateSLA(task: Task, now: number = Date.now()): SLAResult {
  const targetDays = TASK_SLA_DAYS[task.tag ?? 'other'] ?? TASK_SLA_DAYS.other;

  const endMs = task.status === 'completed' && task.completedAt
    ? new Date(task.completedAt).getTime()
    : now;

  const elapsedDays = task.createdAt ? daysBetween(task.createdAt, endMs) : 0;

  const dueMs = task.dueDate ? new Date(task.dueDate).getTime() : NaN;
  const overdueDays = !Number.isNaN(dueMs) && now > dueMs && task.status !== 'completed'
    ? Math.floor((now - dueMs) / DAY)
    : 0;

  const state: SLAState = !task.createdAt
    ? 'sin-datos'
    : elapsedDays <= targetDays
      ? 'dentro'
      : 'fuera';

  return { state, targetDays, elapsedDays, overdueDays };
}
