import { useEffect, useRef } from 'react';
import { differenceInHours, parseISO } from 'date-fns';
import { useClientStore } from '@/store/useClientStore';
import { useNotificationStore } from '@/store/useNotificationStore';

/**
 * Vigila las tareas del store y emite notificaciones cuando:
 *  - una tarea está vencida (1 push por tarea, idempotente vía Set local)
 *  - una tarea está a ≤24h de vencer (idempotente, "due_soon")
 *
 * Reemplazar en producción por un job server-side que también dispare
 * email + WhatsApp (WhatsApp Business Cloud API).
 *
 * OJO — ESTO NO ES LA CAMPANA. Desde el 15-sep hay dos cosas distintas, y es
 * a propósito:
 *
 *   · La CAMPANA del header (`useMisPendientes`) es PERSONAL: solo tus tareas
 *     retrasadas y las que vencen hoy. Se calcula en vivo y no guarda nada.
 *   · Esto alimenta el panel de "Alertas pendientes" del Dashboard, que es la
 *     vista de PORTAFOLIO: todo lo que requiere atención en la agencia.
 *
 * Por eso los dos números no coinciden, y no es un error. Si algún día parecen
 * el mismo dato y alguien los unifica, lo que se pierde es que un miembro vea
 * lo suyo sin el ruido de los otros clientes.
 *
 * Además de avisar, esto MANTIENE `isDelayed`/`delayDays` en las tareas, que
 * son campos guardados y los usa el resto de la app (ver utils/vencidas.ts).
 * No se puede quitar sin mover eso a otro sitio.
 */
export function useTaskMonitor() {
  const tasks = useClientStore((s) => s.tasks);
  const clients = useClientStore((s) => s.clients);
  const updateTask = useClientStore((s) => s.updateTask);
  const push = useNotificationStore((s) => s.push);
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const check = () => {
      const now = new Date();
      for (const t of tasks) {
        if (t.status === 'completed') continue;
        const due = parseISO(t.dueDate);
        const hours = differenceInHours(due, now);
        const client = clients.find((c) => c.id === t.clientId);

        if (hours < 0) {
          const key = `overdue:${t.id}`;
          const days = Math.ceil(Math.abs(hours) / 24);
          if (!t.isDelayed || t.delayDays !== days) {
            updateTask(t.id, { isDelayed: true, delayDays: days });
          }
          if (!firedRef.current.has(key)) {
            firedRef.current.add(key);
            push({
              userId: 'u_owner',
              clientId: t.clientId,
              entityId: t.id,
              type: 'task_overdue',
              urgency: 'high',
              channel: 'in_app',
              message: `Tarea "${t.title}" vencida hace ${days} día${days === 1 ? '' : 's'} — ${client?.name ?? ''}`,
            });
          }
        } else if (hours <= 24) {
          const key = `soon:${t.id}`;
          if (!firedRef.current.has(key)) {
            firedRef.current.add(key);
            push({
              userId: 'u_owner',
              clientId: t.clientId,
              entityId: t.id,
              type: 'task_due_soon',
              urgency: 'normal',
              channel: 'in_app',
              message: `"${t.title}" vence en ${hours}h — ${client?.name ?? ''}`,
            });
          }
        }
      }
    };

    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [tasks, clients, push, updateTask]);
}
