import { useCallback, useMemo } from 'react';
import { startOfWeek, addDays, format, parseISO, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { Target, CheckCircle2, Calendar } from 'lucide-react';
import type { Meeting } from '@/types/meeting';
import { useClientStore } from '@/store/useClientStore';

const TYPE_LABEL: Record<string, string> = {
  kickoff: 'Kickoff', weekly_metrics: 'Revisión semanal', content_strategy: 'Estrategia de contenido',
  ads_review: 'Revisión de ADS', monthly_closing: 'Cierre mensual', crisis: 'Crisis / Urgente',
  weekly_planning: 'Planeación semanal', ropre_strategy: 'Estrategia ROPRE & Entregables',
  weekly_closing: 'Sprint de cierre de semana', general: 'Reunión general', management: 'Reunión de gerencia',
};

/**
 * Arranque del cierre de sprint: recuento de la semana que se cierra.
 *
 * Trae tres cosas reales, nada inventado:
 *  1. El objetivo que se planteó en la reunión de Planeación de esta misma
 *     semana — si esa reunión se corrió con Modo Reunión, sale de su propio
 *     paso "Objetivo" (`modoReunionNotas.objetivo`); si no, de su resumen o
 *     agenda. Si no hubo Planeación esta semana, lo dice en vez de inventarlo.
 *  2. Cumplimiento de tareas de la semana (mismo cálculo que el cierre de
 *     semana del drawer — Lun-Dom, por dueDate o completada en la semana).
 *  3. Un resumen de cada reunión que hubo esta semana, para no empezar el
 *     cierre en blanco.
 */
export function WeekRecapSlide({ meeting, accent }: { meeting: Meeting; accent: string }) {
  const meetings = useClientStore((s) => s.meetings);
  const tasks = useClientStore((s) => s.tasks);

  const weekStart = useMemo(() => startOfWeek(parseISO(meeting.scheduledAt), { weekStartsOn: 1 }), [meeting.scheduledAt]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const inWeek = useCallback((iso?: string) => {
    if (!iso) return false;
    try { return isWithinInterval(parseISO(iso), { start: weekStart, end: weekEnd }); } catch { return false; }
  }, [weekStart, weekEnd]);

  const weekMeetings = useMemo(
    () =>
      meetings
        .filter((m) => m.clientId === meeting.clientId && m.id !== meeting.id && !m.esPrivada && inWeek(m.scheduledAt))
        .sort((a, b) => +parseISO(a.scheduledAt) - +parseISO(b.scheduledAt)),
    [meetings, meeting.clientId, meeting.id, inWeek],
  );

  const planning = weekMeetings.find((m) => m.type === 'weekly_planning');
  const objetivo = planning?.modoReunionNotas?.objetivo?.trim()
    || planning?.summary?.trim()
    || planning?.agenda?.trim()
    || null;

  const weekTasks = useMemo(
    () => tasks.filter((t) => t.clientId === meeting.clientId && !t.esPrivada && (inWeek(t.dueDate) || (t.status === 'completed' && inWeek(t.completedAt)))),
    [tasks, meeting.clientId, inWeek],
  );
  const done = weekTasks.filter((t) => t.status === 'completed').length;
  const pct = weekTasks.length > 0 ? Math.round((done / weekTasks.length) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Objetivo de la semana, de la reunión de Planeación */}
      <div className="rounded-[14px] border border-border-default p-6" style={{ background: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Target className="h-4 w-4" style={{ color: accent }} />
          <span className="text-xs uppercase tracking-wider text-text-muted">Objetivo de la semana — Planeación</span>
        </div>
        {objetivo ? (
          <p className="text-lg text-text-primary">{objetivo}</p>
        ) : (
          <p className="text-base text-text-muted">No hay reunión de Planeación registrada esta semana — sin objetivo que mostrar.</p>
        )}
      </div>

      {/* Cumplimiento de la semana */}
      <div className="rounded-[14px] border border-border-default p-6" style={{ background: 'var(--bg-surface)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" style={{ color: accent }} />
            <span className="text-xs uppercase tracking-wider text-text-muted">Cumplimiento de la semana</span>
          </div>
          <span className="text-sm font-semibold">{done}/{weekTasks.length} · {pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: accent }} />
        </div>
      </div>

      {/* Resumen de las reuniones de la semana */}
      <div className="rounded-[14px] border border-border-default p-6" style={{ background: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4" style={{ color: accent }} />
          <span className="text-xs uppercase tracking-wider text-text-muted">Reuniones de esta semana ({weekMeetings.length})</span>
        </div>
        {weekMeetings.length === 0 ? (
          <p className="text-sm text-text-muted">No hubo más reuniones registradas esta semana.</p>
        ) : (
          <div className="space-y-3">
            {weekMeetings.map((m) => (
              <div key={m.id} className="border-l-2 pl-3" style={{ borderColor: accent }}>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{m.title}</span>
                  <span className="text-xs text-text-muted">{TYPE_LABEL[m.type] ?? m.type} · {format(parseISO(m.scheduledAt), "d MMM", { locale: es })}</span>
                </div>
                <p className="text-sm text-text-secondary mt-0.5">
                  {m.summary?.trim() || 'Sin resumen registrado.'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
