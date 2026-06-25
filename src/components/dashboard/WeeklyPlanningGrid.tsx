import { useMemo, useState } from 'react';
import {
  startOfWeek, addDays, format, parseISO, isSameDay, isWithinInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, ArrowRight } from 'lucide-react';
import type { Task } from '@/types/task';
import { useClientStore } from '@/store/useClientStore';
import { useTeamMembersStore } from '@/store/useTeamMembersStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { toast } from '@/store/useToastStore';
import { ROLE_DEFS } from '@/types/team';

/**
 * Grid Persona × Día (Lun-Vie) para reuniones de tipo 'weekly_planning'.
 *
 * Auto-llena cada celda con las tareas del cliente cuyo dueDate cae en
 * ese día de la semana de la reunión y cuyo assignedTo coincide con el
 * miembro del equipo.
 *
 * El PM puede:
 *  - Click en chip de tarea → "Mover a..." reagenda dueDate a otro día
 *  - Click en celda vacía → crear tarea con responsable + fecha pre-llenados
 *  - Asignar tareas sin fecha al día deseado desde el bloque inferior
 *
 * No usa drag&drop nativo del browser (frágil cross-browser) — usa
 * popovers con botones, más confiable.
 */
export function WeeklyPlanningGrid({
  clientId, weekAnchor, accent,
}: { clientId: string; weekAnchor: string; accent: string }) {
  const allTasks = useClientStore((s) => s.tasks);
  const updateTask = useClientStore((s) => s.updateTask);
  const addTask = useClientStore((s) => s.addTask);
  const members = useTeamMembersStore((s) => s.members);

  // Semana de la reunión (Lun-Vie).
  const weekStart = useMemo(() => startOfWeek(parseISO(weekAnchor), { weekStartsOn: 1 }), [weekAnchor]);
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = addDays(weekStart, 4);

  // Equipo REAL del cliente — las personas del módulo "Salud del equipo" (tabla team_members).
  // Si aún no hay personas cargadas, usamos los responsables únicos de tareas existentes.
  const teamMembers = useMemo(() => {
    const fromTeam = members
      .filter((m) => m.clientId === clientId)
      .map((m) => ({
        name: m.nombre,
        roleSlug: m.rol,
        roleLabel: ROLE_DEFS.find((r) => r.slug === m.rol)?.title ?? m.rol,
      }));
    if (fromTeam.length > 0) return fromTeam;
    // Fallback: extraer de las tareas.
    const unique = Array.from(new Set(
      allTasks.filter((t) => t.clientId === clientId).map((t) => t.assignedTo).filter(Boolean),
    ));
    return unique.map((name) => ({ name, roleSlug: 'strategist' as const, roleLabel: '—' }));
  }, [members, clientId, allTasks]);

  // Tareas del cliente que caen en la semana mostrada.
  const weekTasks = useMemo(() => allTasks.filter((t) => {
    if (t.clientId !== clientId || t.status === 'completed') return false;
    try {
      const d = parseISO(t.dueDate);
      return isWithinInterval(d, { start: weekStart, end: weekEnd });
    } catch { return false; }
  }), [allTasks, clientId, weekStart, weekEnd]);

  // Tareas pendientes SIN fecha esta semana (pero asignadas al cliente).
  const noDateTasks = useMemo(() => allTasks.filter((t) => {
    if (t.clientId !== clientId || t.status === 'completed') return false;
    try {
      const d = parseISO(t.dueDate);
      return !isWithinInterval(d, { start: weekStart, end: weekEnd });
    } catch { return true; }
  }), [allTasks, clientId, weekStart, weekEnd]);

  const moveTask = (taskId: string, targetDay: Date) => {
    // Conserva la hora de dueDate original — solo cambia el día.
    const t = allTasks.find((x) => x.id === taskId);
    if (!t) return;
    const original = (() => { try { return parseISO(t.dueDate); } catch { return new Date(); } })();
    const newDate = new Date(targetDay);
    newDate.setHours(original.getHours(), original.getMinutes(), 0, 0);
    updateTask(taskId, { dueDate: newDate.toISOString() });
    toast.success(`Tarea movida a ${format(targetDay, "EEEE d", { locale: es })}`);
  };

  const createQuickTask = (memberName: string, day: Date) => {
    const title = prompt(`Nueva tarea para ${memberName} el ${format(day, "EEEE d MMM", { locale: es })}:`);
    if (!title?.trim()) return;
    const newTask: Task = {
      id: crypto.randomUUID(),
      clientId,
      title: title.trim(),
      status: 'pending',
      priority: 'P2',
      assignedTo: memberName,
      dueDate: new Date(day.getTime() + 10 * 60 * 60 * 1000).toISOString(), // 10am default
      isDelayed: false,
      delayDays: 0,
      moduleTag: 'meeting',
      tag: 'other',
      createdAt: new Date().toISOString(),
    };
    addTask(newTask);
    toast.success('Tarea creada');
  };

  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
        📅 Distribución de tareas por día — semana del {format(weekStart, "d MMM", { locale: es })}
      </div>

      {teamMembers.length === 0 ? (
        <div className="rounded-md border border-border-subtle bg-bg-base/30 p-4 text-sm text-text-muted">
          Sin equipo asignado a este cliente todavía. Configura el equipo en el módulo Equipo del cerebro.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-text-muted">Persona</th>
                {days.map((d) => (
                  <th key={d.toISOString()} className="text-left px-2 py-1.5 min-w-[140px]">
                    <div className="text-[10px] uppercase tracking-wider text-text-muted">{format(d, 'EEE', { locale: es })}</div>
                    <div className="text-sm font-semibold text-text-primary">{format(d, 'd MMM', { locale: es })}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teamMembers.map((m) => (
                <tr key={`${m.name}-${m.roleSlug}`}>
                  <td className="px-2 py-2 align-top">
                    <div className="text-xs font-semibold text-text-primary">{m.name}</div>
                    <div className="text-[10px] text-text-muted">{m.roleLabel}</div>
                  </td>
                  {days.map((d) => {
                    const cellTasks = weekTasks.filter((t) => t.assignedTo === m.name && isSameDay(parseISO(t.dueDate), d));
                    return (
                      <td key={d.toISOString()} className="align-top">
                        <div className="rounded-md border border-border-subtle bg-bg-base/30 p-1.5 min-h-[80px] space-y-1">
                          {cellTasks.map((t) => (
                            <TaskChip key={t.id} task={t} days={days} currentDay={d} onMove={moveTask} />
                          ))}
                          <button
                            onClick={() => createQuickTask(m.name, d)}
                            className="w-full text-[10px] text-text-muted hover:text-accent-violet inline-flex items-center justify-center gap-1 py-1 rounded hover:bg-accent-violet/5"
                          >
                            <Plus className="h-2.5 w-2.5" /> Nueva
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tareas sin fecha en la semana */}
      {noDateTasks.length > 0 && (
        <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-text-muted">
            Tareas pendientes fuera de esta semana ({noDateTasks.length})
          </div>
          <div className="space-y-1">
            {noDateTasks.slice(0, 10).map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-surface px-2 py-1.5">
                <Badge tone={t.priority === 'P1' ? 'danger' : t.priority === 'P2' ? 'warning' : 'neutral'}>{t.priority}</Badge>
                <span className="text-xs text-text-primary flex-1 truncate">{t.title}</span>
                <span className="text-[10px] text-text-muted">{t.assignedTo}</span>
                <AssignDayMenu days={days} onAssign={(d) => moveTask(t.id, d)} />
              </div>
            ))}
            {noDateTasks.length > 10 && (
              <div className="text-[10px] text-text-muted text-center pt-1">+{noDateTasks.length - 10} más</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskChip({
  task, days, currentDay, onMove,
}: { task: Task; days: Date[]; currentDay: Date; onMove: (id: string, day: Date) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const otherDays = days.filter((d) => !isSameDay(d, currentDay));
  const priorityTone = task.priority === 'P1' ? 'danger' : task.priority === 'P2' ? 'warning' : 'neutral';
  return (
    <div className="relative rounded border border-border-subtle bg-bg-surface px-1.5 py-1 group">
      <div className="flex items-start gap-1">
        <Badge tone={priorityTone}>{task.priority}</Badge>
        <div className="flex-1 text-[10px] text-text-primary leading-tight">{task.title}</div>
      </div>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="text-[9px] text-text-muted hover:text-accent-violet mt-0.5 inline-flex items-center gap-0.5"
      >
        Mover <ArrowRight className="h-2 w-2" />
      </button>
      {menuOpen && (
        <div className="absolute z-10 top-full right-0 mt-1 rounded-md border border-border-default bg-bg-elevated shadow-xl p-1 space-y-0.5 min-w-[110px]">
          {otherDays.map((d) => (
            <button
              key={d.toISOString()}
              onClick={() => { onMove(task.id, d); setMenuOpen(false); }}
              className="w-full text-left text-[10px] px-2 py-1 hover:bg-bg-hover rounded"
            >
              {format(d, "EEE d", { locale: es })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AssignDayMenu({ days, onAssign }: { days: Date[]; onAssign: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>Asignar día</Button>
      {open && (
        <div className="absolute z-10 top-full right-0 mt-1 rounded-md border border-border-default bg-bg-elevated shadow-xl p-1 space-y-0.5 min-w-[110px]">
          {days.map((d) => (
            <button
              key={d.toISOString()}
              onClick={() => { onAssign(d); setOpen(false); }}
              className="w-full text-left text-[10px] px-2 py-1 hover:bg-bg-hover rounded"
            >
              {format(d, "EEE d", { locale: es })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
