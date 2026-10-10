import { useMemo } from 'react';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useClientStore } from '@/store/useClientStore';
import { resolveAssignee } from '@/utils/roleResolver';
import type { Task } from '@/types/task';

type Bucket = 'done' | 'progress' | 'blocked';

const BUCKET_ORDER: Bucket[] = ['progress', 'blocked', 'done'];
const BUCKET_LABEL: Record<Bucket, string> = { done: 'Hecho', progress: 'En curso', blocked: 'Bloqueado' };
const BUCKET_ICON: Record<Bucket, typeof CheckCircle2> = { done: CheckCircle2, progress: Clock, blocked: AlertTriangle };
const BUCKET_COLOR: Record<Bucket, string> = { done: '#10B981', progress: '#06B6D4', blocked: '#EF4444' };

function bucketOf(t: Task): Bucket {
  if (t.status === 'completed') return 'done';
  if (t.status === 'blocked') return 'blocked';
  return 'progress'; // pending / in_progress / in_review
}

/**
 * Tareas reales del cliente agrupadas por responsable — "hecho / en curso /
 * bloqueado", jaladas en vivo del mismo store que alimenta el módulo de
 * Tareas (sin duplicar datos). Nunca muestra tareas privadas: esto se
 * comparte en pantalla durante la reunión.
 */
export function ReviewTasksSlide({ clientId, accent }: { clientId: string; accent: string }) {
  const tasks = useClientStore((s) => s.tasks);

  const byPerson = useMemo(() => {
    const open = tasks.filter((t) => t.clientId === clientId && !t.esPrivada);
    const groups = new Map<string, Task[]>();
    for (const t of open) {
      const nombre = resolveAssignee(t.assignedTo, clientId);
      groups.set(nombre, [...(groups.get(nombre) ?? []), t]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tasks, clientId]);

  if (byPerson.length === 0) {
    return (
      <div className="rounded-[14px] border border-border-default border-dashed p-8 text-center text-text-muted">
        Este cliente no tiene tareas registradas todavía.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {byPerson.map(([nombre, personTasks]) => (
        <div key={nombre} className="rounded-[14px] border border-border-default p-5" style={{ background: 'var(--bg-surface)' }}>
          <h3 className="font-semibold text-lg mb-3">{nombre}</h3>
          <div className="space-y-1.5">
            {BUCKET_ORDER.flatMap((bucket) =>
              personTasks.filter((t) => bucketOf(t) === bucket).map((t) => {
                const Icon = BUCKET_ICON[bucket];
                return (
                  <div key={t.id} className="flex items-center gap-2.5 py-1">
                    <Icon className="h-4 w-4 flex-shrink-0" style={{ color: BUCKET_COLOR[bucket] }} />
                    <span className="text-sm text-text-secondary flex-1">{t.title}</span>
                    <span
                      className="text-[11px] font-medium uppercase tracking-wider flex-shrink-0"
                      style={{ color: BUCKET_COLOR[bucket] }}
                    >
                      {BUCKET_LABEL[bucket]}
                    </span>
                  </div>
                );
              }),
            )}
          </div>
        </div>
      ))}
      <p className="text-xs text-text-muted flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        {tasks.filter((t) => t.clientId === clientId && !t.esPrivada).length} tareas en total
      </p>
    </div>
  );
}
