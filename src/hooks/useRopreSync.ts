import { useEffect, useRef } from 'react';
import { useClientStore } from '@/store/useClientStore';
import { useRopreStore } from '@/store/useRopreStore';

/**
 * Sincronización bidireccional ROPRE ↔ Tareas.
 *
 *  - Si una tarea ligada a un entregable pasa a `completed`,
 *    el entregable en ROPRE se marca `done`.
 *  - Si un entregable en ROPRE pasa a `done`, la tarea ligada
 *    se marca `completed`.
 *
 * Se reconcilian sólo cambios reales (idempotente) para evitar loops.
 */
export function useRopreSync() {
  const tasks = useClientStore((s) => s.tasks);
  const ropreItems = useRopreStore((s) => s.items);
  const updateTask = useClientStore((s) => s.updateTask);
  const updateRopre = useRopreStore((s) => s.update);
  const inFlight = useRef(false);

  useEffect(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      // Tarea completed → entregable done
      for (const task of tasks) {
        if (task.origin?.type !== 'ropre') continue;
        if (task.status !== 'completed') continue;
        const item = ropreItems.find((i) => i.id === task.origin!.itemId);
        if (item && item.type === 'deliverable' && item.status !== 'done') {
          updateRopre(item.id, { status: 'done' });
        }
      }
      // Entregable done → tarea completed
      for (const item of ropreItems) {
        if (item.type !== 'deliverable') continue;
        if (item.status !== 'done' || !item.linkedTaskId) continue;
        const task = tasks.find((t) => t.id === item.linkedTaskId);
        if (task && task.status !== 'completed') {
          updateTask(task.id, {
            status: 'completed',
            completedAt: new Date().toISOString(),
          });
        }
      }
    } finally {
      inFlight.current = false;
    }
  }, [tasks, ropreItems, updateTask, updateRopre]);
}
