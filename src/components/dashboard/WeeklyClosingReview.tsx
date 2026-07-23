import { useMemo } from 'react';
import {
  startOfWeek, addDays, format, parseISO, isWithinInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Task } from '@/types/task';
import { useClientStore } from '@/store/useClientStore';
import { Badge } from '@/components/ui/Badge';

/**
 * Resumen de cierre de semana para reuniones tipo 'weekly_closing'.
 *
 * Toma la semana de la reunión (Lun-Dom) y muestra, en vivo desde el store:
 *  - Cumplimiento global: N completadas / M totales de la semana + barra %.
 *  - ✅ Lo que se hizo: tareas completadas (por dueDate o completedAt en la semana).
 *  - ⏳ Lo que NO se hizo: tareas de la semana aún abiertas, vencidas resaltadas.
 *  - Cumplimiento por persona: completadas/total por responsable.
 *
 * No edita nada — es el insumo de seguimiento del PM; las decisiones
 * (reprogramar, reasignar) se toman en el módulo Tareas o en la agenda.
 */
export function WeeklyClosingReview({
  clientId, weekAnchor, accent,
}: { clientId: string; weekAnchor: string; accent: string }) {
  const allTasks = useClientStore((s) => s.tasks);

  // Semana de la reunión (Lun-Dom) — el cierre incluye el fin de semana.
  const weekStart = useMemo(() => startOfWeek(parseISO(weekAnchor), { weekStartsOn: 1 }), [weekAnchor]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  // Tarea "de la semana": su dueDate cae en la semana, o se completó en la semana.
  const weekTasks = useMemo(() => allTasks.filter((t) => {
    if (t.clientId !== clientId) return false;
    const inWeek = (iso?: string) => {
      if (!iso) return false;
      try { return isWithinInterval(parseISO(iso), { start: weekStart, end: weekEnd }); } catch { return false; }
    };
    return inWeek(t.dueDate) || (t.status === 'completed' && inWeek(t.completedAt));
  }), [allTasks, clientId, weekStart, weekEnd]);

  const done = weekTasks.filter((t) => t.status === 'completed');
  const open = weekTasks.filter((t) => t.status !== 'completed');
  const pct = weekTasks.length > 0 ? Math.round((done.length / weekTasks.length) * 100) : 0;

  // Cumplimiento por responsable.
  const byPerson = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const t of weekTasks) {
      const who = t.assignedTo || '(sin responsable)';
      const e = map.get(who) ?? { done: 0, total: 0 };
      e.total++;
      if (t.status === 'completed') e.done++;
      map.set(who, e);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [weekTasks]);

  const now = new Date();
  const overdueDays = (t: Task) => {
    try { return Math.floor((now.getTime() - parseISO(t.dueDate).getTime()) / 86400000); } catch { return 0; }
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
        🏁 Cierre de semana — {format(weekStart, "d MMM", { locale: es })} al {format(weekEnd, "d MMM", { locale: es })}
      </div>

      {weekTasks.length === 0 ? (
        <div className="rounded-md border border-border-subtle bg-bg-base/30 p-4 text-sm text-text-muted">
          No hay tareas con fecha en esta semana para este cliente.
        </div>
      ) : (
        <>
          {/* Cumplimiento global */}
          <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">Cumplimiento de la semana</span>
              <span className="font-semibold text-text-primary">{done.length}/{weekTasks.length} · {pct}%</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
            </div>
          </div>

          {/* Lo que se hizo */}
          <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-text-muted">
              ✅ Completadas ({done.length})
            </div>
            {done.length === 0 && <div className="text-xs text-text-muted">Ninguna tarea completada esta semana.</div>}
            {done.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-surface px-2 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-status-success shrink-0" />
                <span className="text-xs text-text-primary flex-1 truncate">{t.title}</span>
                <span className="text-[10px] text-text-muted">{t.assignedTo}</span>
              </div>
            ))}
          </div>

          {/* Lo que NO se hizo */}
          <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-text-muted">
              ⏳ No completadas ({open.length}) — decidir: reprogramar, reasignar o cancelar
            </div>
            {open.length === 0 && <div className="text-xs text-status-success">Todo lo de la semana quedó cerrado 🎉</div>}
            {open.map((t) => {
              const late = overdueDays(t);
              return (
                <div key={t.id} className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-surface px-2 py-1.5">
                  <Badge tone={t.priority === 'P1' ? 'danger' : t.priority === 'P2' ? 'warning' : 'neutral'}>{t.priority}</Badge>
                  <span className="text-xs text-text-primary flex-1 truncate">{t.title}</span>
                  {t.status === 'blocked' && <Badge tone="danger">Bloqueada</Badge>}
                  {late > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-status-danger">
                      <AlertTriangle className="h-2.5 w-2.5" /> hace {late}d
                    </span>
                  )}
                  <span className="text-[10px] text-text-muted">{t.assignedTo}</span>
                </div>
              );
            })}
          </div>

          {/* Cumplimiento por persona */}
          {byPerson.length > 1 && (
            <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-text-muted">
                👥 Cumplimiento por responsable
              </div>
              {byPerson.map(([who, s]) => {
                const p = Math.round((s.done / s.total) * 100);
                return (
                  <div key={who} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate text-text-primary">{who}</span>
                    <div className="w-24 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${p}%`, background: accent }} />
                    </div>
                    <span className="w-14 text-right text-text-muted">{s.done}/{s.total} · {p}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
